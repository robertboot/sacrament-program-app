-- Stake speakers: a one-off name printed on the program but NOT recorded in
-- the speakers table or factored into rotation. Used when a visiting stake
-- member is invited to speak.

alter table speaking_assignments
  add column if not exists custom_speaker_name text;

create or replace function guard_locked_assignment()
returns trigger language plpgsql as $$
begin
  if (old.status <> 'not_yet_asked' and new.status <> 'not_yet_asked') then
    if (old.topic_id is distinct from new.topic_id
        or coalesce(old.custom_topic_text, '') <> coalesce(new.custom_topic_text, '')
        or old.speaker_id is distinct from new.speaker_id
        or coalesce(old.custom_speaker_name, '') <> coalesce(new.custom_speaker_name, '')) then
      raise exception 'Cannot change speaker or topic once assignment is locked. Reset slot first.';
    end if;
  end if;
  if (new.status = 'not_yet_asked' and old.status <> 'not_yet_asked') then
    new.asked_at := null;
    new.asked_by := null;
    new.confirmed_at := null;
    new.declined_at := null;
  end if;
  if (new.status = 'awaiting_confirmation' and old.status is distinct from 'awaiting_confirmation') then
    new.asked_at := coalesce(new.asked_at, now());
    new.asked_by := coalesce(new.asked_by, auth.uid());
  end if;
  if (new.status = 'confirmed' and old.status is distinct from 'confirmed') then
    new.confirmed_at := coalesce(new.confirmed_at, now());
  end if;
  if (new.status = 'declined' and old.status is distinct from 'declined') then
    new.declined_at := coalesce(new.declined_at, now());
  end if;
  return new;
end;
$$;

-- Bring the public share payload up to date — speaker_name now falls back to
-- the custom name when no branch speaker is linked.
create or replace function get_published_program(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_result json;
begin
  select to_json(payload) into v_result from (
    select
      p.id, p.meeting_date, p.presiding, p.welcome_text, p.brief_reminders,
      p.invocation, p.benediction, p.chorister, p.organist,
      p.releases, p.sustainings, p.move_in_welcomes, p.aaronic_sustainings,
      p.baptism_confirmation, p.baby_blessing, p.stake_business,
      p.ward_business_releases, p.ward_business_sustainings,
      p.ward_business_move_in_welcomes, p.ward_business_aaronic_sustainings,
      p.ward_business_baptism_confirmation, p.ward_business_baby_blessing,
      p.intermediate_hymn_text, p.meeting_type, p.meeting_type_label,
      (select to_json(c) from (
        select pr.full_name, pr.bishopric_position from profiles pr where pr.id = p.conducting_id
      ) c) as conducting,
      (select to_json(h) from (select number, title from hymns where id = p.opening_hymn_id) h) as opening_hymn,
      (select to_json(h) from (select number, title from hymns where id = p.sacrament_hymn_id) h) as sacrament_hymn,
      (select to_json(h) from (select number, title from hymns where id = p.intermediate_hymn_id) h) as intermediate_hymn,
      (select to_json(h) from (select number, title from hymns where id = p.closing_hymn_id) h) as closing_hymn,
      (
        select json_agg(json_build_object(
          'slot', a.slot, 'length_minutes', a.length_minutes,
          'speaker_name', coalesce(sp.full_name, a.custom_speaker_name),
          'topic_title', coalesce(t.title, a.custom_topic_text),
          'topic_description', t.description
        ) order by case a.slot when 'first' then 1 when 'second' then 2 when 'concluding' then 3 end)
        from speaking_assignments a
        left join speakers sp on sp.id = a.speaker_id
        left join topics t on t.id = a.topic_id
        where a.program_id = p.id
      ) as assignments,
      (
        select coalesce(json_agg(json_build_object(
          'title', e.title, 'description', e.description, 'event_date', e.event_date
        ) order by e.event_date nulls last), '[]'::json)
        from events e where p.meeting_date between e.display_start and e.display_end
      ) as events,
      (select to_json(s) from (
        select branch_name, unit_type from app_settings where id = 1
      ) s) as settings
    from programs p
    where p.share_token = p_token and p.status = 'published'
  ) payload;
  return v_result;
end;
$$;
