-- Fix: speaker.last_spoke_date was being recomputed only from
-- speaking_assignments, ignoring the historical_dates JSON backfill the bishop
-- entered for talks given before this app existed. That made most speakers'
-- "Last spoke" label read "Never" even when they'd spoken many times.
--
-- This update teaches the recompute function to take the MAX across both
-- sources (forward-going assignments + manual backfill), then backfills every
-- existing speaker so the UI immediately reflects reality.

create or replace function recompute_speaker_last_spoke(p_speaker_id uuid)
returns void language sql as $$
  update speakers s set last_spoke_date = greatest(
    (select max(p.meeting_date)
       from speaking_assignments a
       join programs p on p.id = a.program_id
       where a.speaker_id = p_speaker_id
         and a.status = 'confirmed'
         and p.meeting_date <= current_date),
    (select max((d)::date)
       from jsonb_array_elements_text(s.historical_dates) as d
       where (d)::date <= current_date)
  )
  where s.id = p_speaker_id;
$$;

-- One-time backfill for every speaker so their card stops saying "Never".
select recompute_speaker_last_spoke(id) from speakers;
