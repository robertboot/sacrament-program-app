-- Speakers can now optionally say WHY they declined. The reason is captured
-- either on the /c/[token] web page (primary path) or via a follow-up SMS
-- ("Reply now with a reason if you'd like to share one") — see
-- src/app/api/sms/inbound/route.ts.

alter table speaking_assignments
  add column if not exists decline_reason text;

-- Update the confirm RPC to accept an optional reason. Only stored when the
-- response is 'declined' — a confirm never carries one.
create or replace function respond_to_assignment(
  p_token uuid,
  p_response text,
  p_reason text default null
)
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
        confirmation_source = 'self',
        decline_reason = case
          when p_response = 'declined' and coalesce(nullif(trim(p_reason), ''), null) is not null
            then trim(p_reason)
          else decline_reason
        end
    where id = v_assignment_id;
  return jsonb_build_object('ok', true, 'status', p_response);
end;
$$;

-- Add / update a reason after the initial decline (used when the web page
-- decline was submitted without a reason and the speaker taps back in, or
-- when the SMS follow-up captures a reason on a subsequent inbound). No-op
-- if the assignment isn't currently declined.
create or replace function set_decline_reason(
  p_token uuid,
  p_reason text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_new_reason text;
begin
  v_new_reason := coalesce(nullif(trim(p_reason), ''), null);
  select id into v_id from speaking_assignments
    where confirm_token = p_token and status = 'declined';
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'No declined assignment.');
  end if;
  update speaking_assignments
    set decline_reason = v_new_reason
    where id = v_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Extend the confirm-page lookup to expose decline_reason so the /c/[token]
-- page can render it back to the speaker and offer to add / edit one.
create or replace function get_assignment_by_confirm_token(p_token uuid)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id, 'slot', a.slot, 'length_minutes', a.length_minutes,
    'status', a.status, 'last_response', a.last_response,
    'responded_at', a.responded_at, 'confirmation_source', a.confirmation_source,
    'decline_reason', a.decline_reason,
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

-- Extend the pending-invite RPC to also return slot + topic so the SMS
-- inbound webhook can restate them in the Y / N confirmation TwiML.
-- Speakers driving or checking their phone quickly get a full receipt
-- of what they just confirmed / declined.
create or replace function resolve_pending_assignment_for_phone(p_phone text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id,
    'speaker_name', s.full_name,
    'speaker_phone', s.phone,
    'status', a.status,
    'meeting_date', p.meeting_date,
    'slot', a.slot,
    'topic_title', coalesce(t.title, a.custom_topic_text)
  )
  from speaking_assignments a
  join speakers s on s.id = a.speaker_id
  join programs p on p.id = a.program_id
  left join topics t on t.id = a.topic_id
  where s.phone is not null
    and regexp_replace(s.phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
    and a.status = 'awaiting_confirmation'
  order by a.invited_at desc nulls last
  limit 1;
$$;

grant execute on function resolve_pending_assignment_for_phone(text) to anon, authenticated;

-- Return the most recent declined assignment for a phone number that's
-- still awaiting a reason. Used by the SMS inbound webhook to route
-- follow-up messages ("<free text>") into decline_reason instead of the
-- default "we couldn't find an invitation" bounce.
--
-- 6h window because most people who are going to reply with a reason will
-- do so within the same conversation — anything later is stale and
-- shouldn't be captured silently.
create or replace function resolve_awaiting_reason_for_phone(p_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row record;
begin
  select sa.id, sa.confirm_token, sp.full_name as speaker_name
    into v_row
  from speaking_assignments sa
  join speakers sp on sp.id = sa.speaker_id
  where sp.phone = p_phone
    and sa.status = 'declined'
    and sa.decline_reason is null
    and sa.responded_at is not null
    and sa.responded_at > now() - interval '6 hours'
  order by sa.responded_at desc
  limit 1;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_row.id,
    'confirm_token', v_row.confirm_token,
    'speaker_name', v_row.speaker_name
  );
end;
$$;
