-- Bishopric can "advance" the Planner past this Sunday from noon onward,
-- once sacrament meeting is over, so the featured card immediately shows
-- next Sunday instead of waiting for midnight rollover. Shared across the
-- whole bishopric — one leader taps Advance and every leader's Home /
-- Planner rolls with it.
--
-- Semantics: the effective "today" for upcoming queries is
--   max(current_date, today_override)
-- so the override naturally becomes a no-op once the real date catches
-- up. No cleanup cron needed.

alter table app_settings
  add column if not exists today_override date;
