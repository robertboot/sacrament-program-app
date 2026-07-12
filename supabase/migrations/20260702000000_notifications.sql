-- Notification system v1.
--
-- One row per (recipient user, event). The bell dropdown reads from here.
-- Events are fanned out on the server side (see notifyBishopric() in
-- src/lib/notifications.ts): we insert N rows when N leaders should be
-- pinged, rather than joining a topics table at read time. That keeps the
-- read path index-only and mark-as-read trivial.
--
-- `type` is a machine-readable event tag ("speaker_confirmed",
-- "speaker_declined", "speaker_silent", "slot_needs_approval",
-- "program_published"). Kept as text so we don't have to migrate an enum
-- every time a new event is added.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  action_url text,
  read_at timestamptz,
  delivered_sms_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on notifications (user_id, created_at desc)
  where read_at is null;

-- Per-user SMS opt-in. The senior leader (Bishop / Branch President) gets
-- the SMS side of leader-facing events by default; anyone can flip it off.
alter table profiles
  add column if not exists sms_notifications_enabled boolean not null default true;

-- Silent-48h sweeper needs a marker so it doesn't ping every day.
alter table speaking_assignments
  add column if not exists silence_flagged_at timestamptz;
