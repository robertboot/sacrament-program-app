-- Allow the bishopric to swap the speaker on a locked assignment without
-- having to "Reset slot" first. When a swap happens, reset the status back to
-- not_yet_asked so the new speaker gets a clean state (rather than inheriting
-- the previous speaker's confirmed/awaiting_confirmation flag).
--
-- Topic changes were already loosened in 20260513000002. This pass loosens
-- the speaker side too, with the safety net of auto-resetting the status.

create or replace function guard_locked_assignment()
returns trigger language plpgsql as $$
begin
  -- If the speaker is being swapped on a locked row, the new speaker has
  -- not been invited yet — bounce status back to not_yet_asked.
  if (old.status <> 'not_yet_asked'
      and (old.speaker_id is distinct from new.speaker_id
           or coalesce(old.custom_speaker_name, '') <> coalesce(new.custom_speaker_name, ''))) then
    new.status := 'not_yet_asked';
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
