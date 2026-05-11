-- Per-speaker JSON array of historical talk dates (from before the app
-- existed). Speaking_assignments handles forward-going history; this column
-- holds the manual backfill list so the bishop can verify what's recorded.

alter table speakers
  add column if not exists historical_dates jsonb not null default '[]'::jsonb;
