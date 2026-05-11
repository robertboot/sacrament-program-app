-- Tracks how an assignment reached its current status: did the speaker
-- self-confirm via SMS/link, or did the bishopric mark it manually?

alter table speaking_assignments
  add column if not exists confirmation_source text
  check (confirmation_source in ('self', 'manual'));

-- The respond function (self-confirm path) explicitly stamps 'self'.
create or replace function respond_to_assignment(p_token uuid, p_response text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_assignment_id uuid;
begin
  if p_response not in ('confirmed','declined') then
    raise exception 'Invalid response.';
  end if;
  select id into v_assignment_id from speaking_assignments where confirm_token = p_token;
  if v_assignment_id is null then
    return jsonb_build_object('ok', false, 'error', 'Link not found.');
  end if;
  update speaking_assignments
    set status = p_response::assignment_status,
        last_response = p_response,
        responded_at = now(),
        confirmation_source = 'self'
    where id = v_assignment_id;
  return jsonb_build_object('ok', true, 'status', p_response);
end;
$$;

-- Bishopric updates default to 'manual' unless the caller already set
-- confirmation_source themselves (which only respond_to_assignment does).
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
    new.confirmation_source := null;
  end if;
  if (new.status = 'awaiting_confirmation' and old.status is distinct from 'awaiting_confirmation') then
    new.asked_at := coalesce(new.asked_at, now());
    new.asked_by := coalesce(new.asked_by, auth.uid());
  end if;
  if (new.status = 'confirmed' and old.status is distinct from 'confirmed') then
    new.confirmed_at := coalesce(new.confirmed_at, now());
    if (new.confirmation_source is not distinct from old.confirmation_source) then
      new.confirmation_source := 'manual';
    end if;
  end if;
  if (new.status = 'declined' and old.status is distinct from 'declined') then
    new.declined_at := coalesce(new.declined_at, now());
    if (new.confirmation_source is not distinct from old.confirmation_source) then
      new.confirmation_source := 'manual';
    end if;
  end if;
  return new;
end;
$$;

-- Update the public read function to expose confirmation_source.
create or replace function get_assignment_by_confirm_token(p_token uuid)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id, 'slot', a.slot, 'length_minutes', a.length_minutes,
    'status', a.status, 'last_response', a.last_response,
    'responded_at', a.responded_at, 'confirmation_source', a.confirmation_source,
    'meeting_date', p.meeting_date,
    'speaker_name', coalesce(s.full_name, a.custom_speaker_name),
    'topic_title', coalesce(t.title, a.custom_topic_text),
    'topic_description', t.description,
    'branch_name', (select branch_name from app_settings where id = 1),
    'unit_type', (select unit_type from app_settings where id = 1)
  )
  from speaking_assignments a
  join programs p on p.id = a.program_id
  left join speakers s on s.id = a.speaker_id
  left join topics t on t.id = a.topic_id
  where a.confirm_token = p_token;
$$;

-- Public function used by the inbound SMS webhook to find the most recent
-- pending assignment for a given phone number. Bypasses RLS so the Twilio
-- handler doesn't need user auth.
create or replace function resolve_pending_assignment_for_phone(p_phone text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id,
    'speaker_name', s.full_name,
    'speaker_phone', s.phone,
    'status', a.status,
    'meeting_date', p.meeting_date
  )
  from speaking_assignments a
  join speakers s on s.id = a.speaker_id
  join programs p on p.id = a.program_id
  where s.phone is not null
    and regexp_replace(s.phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
    and a.status = 'awaiting_confirmation'
  order by a.invited_at desc nulls last
  limit 1;
$$;

grant execute on function resolve_pending_assignment_for_phone(text) to anon, authenticated;
