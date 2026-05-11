-- Calendar sync: pull events from an iCal subscription URL (e.g. the official
-- Church Calendar feed) so the bishop doesn't have to type them in manually.
-- - app_settings.calendar_ics_url stores the feed URL.
-- - events.external_uid is the iCal VEVENT UID for idempotent dedupe.

alter table app_settings add column if not exists calendar_ics_url text;

alter table events add column if not exists external_uid text;
create unique index if not exists events_external_uid_idx
  on events (external_uid) where external_uid is not null;
