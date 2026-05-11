-- Adds a per-assignment "confirm_token" so a speaker can self-confirm via a
-- public link, plus phone storage on speakers, plus a stamp for when the SMS
-- was sent.

alter table speakers
  add column if not exists phone text;

alter table speaking_assignments
  add column if not exists confirm_token uuid unique default gen_random_uuid(),
  add column if not exists invited_at timestamptz,
  add column if not exists last_response text check (last_response in ('confirmed','declined')),
  add column if not exists responded_at timestamptz;

-- Backfill any old rows that don't have a token.
update speaking_assignments set confirm_token = gen_random_uuid() where confirm_token is null;

-- Public read: just the info needed to render the confirm page.
create or replace function get_assignment_by_confirm_token(p_token uuid)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id,
    'slot', a.slot,
    'length_minutes', a.length_minutes,
    'status', a.status,
    'last_response', a.last_response,
    'responded_at', a.responded_at,
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

-- Public write: speaker taps Yes/No. Idempotent — last click wins.
create or replace function respond_to_assignment(p_token uuid, p_response text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_assignment_id uuid;
  v_status text;
begin
  if p_response not in ('confirmed','declined') then
    raise exception 'Invalid response.';
  end if;
  select id into v_assignment_id from speaking_assignments where confirm_token = p_token;
  if v_assignment_id is null then
    return jsonb_build_object('ok', false, 'error', 'Link not found.');
  end if;
  -- Bypass the bishopric-only lock trigger for this specific update.
  update speaking_assignments
    set status = p_response::assignment_status,
        last_response = p_response,
        responded_at = now()
    where id = v_assignment_id;
  return jsonb_build_object('ok', true, 'status', p_response);
end;
$$;

-- The bishopric lock trigger blocks status changes once invited. For the
-- self-confirm flow the speaker IS the authorized change-maker, so the trigger
-- is allowed to skip when the row's status moves under the
-- respond_to_assignment() function (which runs as definer).
-- (No change to existing trigger; SECURITY DEFINER + direct UPDATE means the
-- trigger sees current_user = postgres and the existing guard accepts it.)

grant execute on function get_assignment_by_confirm_token(uuid) to anon, authenticated;
grant execute on function respond_to_assignment(uuid, text) to anon, authenticated;
