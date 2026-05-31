-- Bishopric-only note shown in red on the dashboard card for that meeting.
-- Never printed; never appears on the conductor or public views.
alter table programs
  add column if not exists planner_note text;
