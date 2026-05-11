-- Meeting type: each Sunday is one of regular, fast_sunday, or no_services.
-- Drives renderer/editor behavior:
--   regular     — full program (speakers + intermediate hymn)
--   fast_sunday — same shell but no speakers + no intermediate hymn
--   no_services — banner only (stake conference, general conference)
-- Auto-create marks the first Sunday of each month as fast_sunday.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'meeting_type') then
    create type meeting_type as enum ('regular', 'fast_sunday', 'no_services');
  end if;
end $$;

alter table programs add column if not exists meeting_type meeting_type not null default 'regular';
alter table programs add column if not exists meeting_type_label text;

update programs set meeting_type = 'fast_sunday'
  where meeting_type = 'regular' and brief_reminders ilike '%fast sunday%';
update programs set meeting_type = 'no_services', meeting_type_label = 'Stake Conference'
  where meeting_type = 'regular' and brief_reminders ilike '%stake conference%';
update programs set meeting_type = 'no_services', meeting_type_label = 'General Conference'
  where meeting_type = 'regular' and brief_reminders ilike '%general conference%';
update programs set meeting_type = 'no_services', meeting_type_label = 'Branch Conference'
  where meeting_type = 'regular' and brief_reminders ilike '%branch conference%';

update programs set brief_reminders = null
  where meeting_type <> 'regular' and brief_reminders is not null
    and (trim(brief_reminders) ilike 'fast sunday%' or trim(brief_reminders) ilike '%conference%');

delete from speaking_assignments
  where program_id in (select id from programs where meeting_type = 'fast_sunday');

update programs set intermediate_hymn_id = null, intermediate_hymn_text = null
  where meeting_type = 'fast_sunday';

create or replace function ensure_next_month_programs()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_max_date date; v_start date; v_end date; v_date date;
  v_program_id uuid; v_conductor uuid;
  v_speaker_first uuid; v_speaker_second uuid; v_speaker_concluding uuid;
  v_topic_first uuid; v_topic_second uuid; v_topic_concluding uuid;
  v_created int := 0; v_is_fast boolean;
begin
  select max(meeting_date) into v_max_date from programs;
  if v_max_date is null then
    v_start := current_date + ((7 - extract(dow from current_date)::int) % 7);
  else
    v_start := v_max_date + interval '7 days';
  end if;
  v_end := (date_trunc('month', v_start) + interval '1 month')::date - 1;

  v_date := v_start;
  while v_date <= v_end loop
    if not exists (select 1 from programs where meeting_date = v_date) then
      v_is_fast := extract(day from v_date) <= 7;
      v_conductor := next_conductor(v_date);
      if v_is_fast then
        insert into programs (meeting_date, conducting_id, status, meeting_type)
          values (v_date, v_conductor, 'draft', 'fast_sunday')
          returning id into v_program_id;
      else
        v_speaker_first := next_speaker(v_date, 'first');
        v_speaker_second := next_speaker(v_date, 'second', array[v_speaker_first]::uuid[]);
        v_speaker_concluding := next_speaker(v_date, 'concluding',
          array[v_speaker_first, v_speaker_second]::uuid[]);
        v_topic_first := next_topic(v_date);
        v_topic_second := next_topic(v_date, array[v_topic_first]::uuid[]);
        v_topic_concluding := next_topic(v_date,
          array[v_topic_first, v_topic_second]::uuid[]);
        insert into programs (meeting_date, conducting_id, status)
          values (v_date, v_conductor, 'draft')
          returning id into v_program_id;
        insert into speaking_assignments (program_id, slot, length_minutes, speaker_id, topic_id) values
          (v_program_id, 'first', 5, v_speaker_first, v_topic_first),
          (v_program_id, 'second', 10, v_speaker_second, v_topic_second),
          (v_program_id, 'concluding', 15, v_speaker_concluding, v_topic_concluding);
      end if;
      v_created := v_created + 1;
    end if;
    v_date := v_date + interval '7 days';
  end loop;
  return v_created;
end;
$$;
