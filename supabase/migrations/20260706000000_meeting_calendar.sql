-- Meeting calendar v1. A Calendly-style scheduling surface for members to
-- book slots with the bishop / branch president, plus admin-side tools to
-- block off time (BYC, interviews with specific people, one-off conflicts).
--
-- Scope choices worth knowing when extending later:
--   * No RLS on these tables yet; the public booking page reads/writes via
--     the service client. The booking token in app_settings is the gate.
--   * All timestamps are stored as timestamptz (UTC). Slot generation in
--     the client renders them in the viewer's local time; admins and
--     members are assumed to share a timezone (the ward's).
--   * Recurrence rules are kept intentionally narrow in v1: "every week on
--     Nth weekday" or "monthly on the Nth weekday of the month". More
--     exotic patterns (iCal RRULE) can come later without breaking the
--     column shape.

create table if not exists meeting_bookings (
  id uuid primary key default gen_random_uuid(),
  meeting_type text not null,                 -- 'interview_30' | 'interview_60' | 'tithing_declaration'
  start_at timestamptz not null,
  end_at timestamptz not null,
  member_name text not null,
  member_email text,
  status text not null default 'confirmed',   -- 'confirmed' | 'cancelled'
  created_at timestamptz not null default now()
);

create index if not exists meeting_bookings_start_idx
  on meeting_bookings (start_at)
  where status = 'confirmed';

-- Blocks occupy time but aren't member-bookable. One row covers EITHER
-- a one-off date (start_at + end_at set, recurrence_* null) OR a
-- recurring pattern (recurrence_* set, start_at + end_at null).
create table if not exists meeting_blocks (
  id uuid primary key default gen_random_uuid(),
  label text not null,                         -- "BYC", "Youth interviews", …
  start_at timestamptz,                        -- one-off only
  end_at timestamptz,                          -- one-off only
  recurrence_kind text,                        -- null | 'weekly' | 'monthly_nth'
  recurrence_day_of_week int,                  -- 0-6 (0 = Sunday)
  recurrence_nth int,                          -- 1-5, for 'monthly_nth'
  recurrence_time text,                        -- 'HH:MM' local time
  recurrence_duration_minutes int,
  created_at timestamptz not null default now(),
  check (
    (start_at is not null and end_at is not null and recurrence_kind is null)
    or
    (recurrence_kind is not null and start_at is null and end_at is null
     and recurrence_day_of_week is not null and recurrence_time is not null
     and recurrence_duration_minutes is not null
     and (recurrence_kind = 'weekly' or recurrence_nth is not null))
  )
);

create index if not exists meeting_blocks_start_idx
  on meeting_blocks (start_at)
  where start_at is not null;

create index if not exists meeting_blocks_recurrence_idx
  on meeting_blocks (recurrence_kind)
  where recurrence_kind is not null;

-- Admin toggles + the public booking token. The token rotates via
-- regenerateBookingToken() to invalidate any stale shared links.
alter table app_settings
  add column if not exists tithing_declarations_enabled boolean not null default false,
  add column if not exists calendar_enabled boolean not null default false,
  add column if not exists booking_token text;

-- Seed a token so the public link works as soon as calendar_enabled flips.
update app_settings
  set booking_token = encode(gen_random_bytes(16), 'hex')
  where id = 1 and booking_token is null;
