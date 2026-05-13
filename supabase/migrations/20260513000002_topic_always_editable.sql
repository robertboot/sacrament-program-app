-- The lock trigger used to forbid BOTH speaker and topic changes once an
-- assignment moved out of not_yet_asked, which made it impossible to nudge
-- a speaker's topic after they had been asked but before they had prepared
-- their talk. Loosen it so only the speaker is locked — the topic stays
-- editable through the meeting day.

create or replace function guard_locked_assignment()
returns trigger language plpgsql as $$
begin
  -- Speaker lock: once we've asked someone, we don't quietly swap them out.
  if (old.status <> 'not_yet_asked' and new.status <> 'not_yet_asked') then
    if (old.speaker_id is distinct from new.speaker_id
        or coalesce(old.custom_speaker_name, '') <> coalesce(new.custom_speaker_name, '')) then
      raise exception 'Cannot change the speaker once they have been asked. Reset slot first.';
    end if;
  end if;
  if (new.status = 'not_yet_asked' and old.status <> 'not_yet_asked') then
    new.asked_at := null;
    new.asked_by := null;
    new.confirmed_at := null;
    new.declined_at := null;
    new.confirmation_source := null;
    new.reminded_at := null;
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
