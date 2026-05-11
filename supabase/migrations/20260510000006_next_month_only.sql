-- Switch the "generate" function from a 3-month batch to a single-month extend.
-- The bishop maintains the rolling 3-month window by clicking once a month
-- (and the cron does the same automatically on the 1st).

create or replace function ensure_next_month_programs()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_max_date date;
  v_start date;
  v_end date;
  v_date date;
  v_program_id uuid;
  v_conductor uuid;
  v_speaker_first uuid;
  v_speaker_second uuid;
  v_speaker_concluding uuid;
  v_topic_first uuid;
  v_topic_second uuid;
  v_topic_concluding uuid;
  v_created int := 0;
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
      v_conductor := next_conductor(v_date);
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

      v_created := v_created + 1;
    end if;

    v_date := v_date + interval '7 days';
  end loop;

  return v_created;
end;
$$;
