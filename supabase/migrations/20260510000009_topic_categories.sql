-- Topics get the same many-to-many category scheme speakers have.
-- 5-min slot (first) pulls from topics tagged 'first'.
-- 10/15-min slots (second / concluding) pull from topics tagged 'second' or
-- 'concluding' (the two are interchangeable per the user's request).

create table if not exists topic_categories (
  topic_id uuid not null references topics(id) on delete cascade,
  category speaker_category not null,
  primary key (topic_id, category)
);
create index if not exists topic_categories_category_idx on topic_categories (category);

alter table topic_categories enable row level security;
create policy "topic_categories read auth" on topic_categories
  for select to authenticated using (true);
create policy "topic_categories bishopric write" on topic_categories
  for all to authenticated using (is_bishopric()) with check (is_bishopric());

-- Backfill existing topics with all three categories so rotation keeps working.
insert into topic_categories (topic_id, category)
select t.id, c.category
from topics t
cross join (values ('first'::speaker_category), ('second'), ('concluding')) as c(category)
on conflict do nothing;

drop function if exists next_topic(date, uuid[]);
create or replace function next_topic(
  p_meeting_date date,
  p_categories speaker_category[] default null,
  p_exclude_ids uuid[] default '{}'::uuid[]
)
returns uuid language sql stable as $$
  with candidates as (
    select t.id, t.last_used_date
    from topics t
    where t.is_active = true
      and not (t.id = any(p_exclude_ids))
      and (p_categories is null or exists (
        select 1 from topic_categories tc
        where tc.topic_id = t.id and tc.category = any(p_categories)
      ))
  ),
  with_future as (
    select c.id,
      greatest(
        coalesce(c.last_used_date, date '1900-01-01'),
        coalesce((
          select max(prg.meeting_date)
          from speaking_assignments a
          join programs prg on prg.id = a.program_id
          where a.topic_id = c.id
            and a.status <> 'declined'
            and prg.meeting_date < p_meeting_date
            and prg.meeting_date >= current_date
        ), date '1900-01-01')
      ) as effective_last
    from candidates c
  )
  select id from with_future order by effective_last asc, id limit 1;
$$;

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
        v_topic_first := next_topic(v_date, array['first']::speaker_category[]);
        v_topic_second := next_topic(v_date,
          array['second','concluding']::speaker_category[],
          array[v_topic_first]::uuid[]);
        v_topic_concluding := next_topic(v_date,
          array['second','concluding']::speaker_category[],
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
