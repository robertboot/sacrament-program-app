-- Collapse tithing declarations to a single 15-minute slot.
--
-- Does two things:
--   1. Fold any bookings that were made under the short-lived
--      'tithing_declaration_15' type back into 'tithing_declaration'
--      (that type name is going away in the app).
--   2. Shrink every existing tithing_declaration booking to 15 min by
--      moving end_at to start_at + 15 minutes. Historical 30-min
--      bookings would otherwise still consume 30 min of the schedule
--      and would mismatch the member-facing duration from this point
--      on.

update meeting_bookings
  set meeting_type = 'tithing_declaration'
  where meeting_type = 'tithing_declaration_15';

update meeting_bookings
  set end_at = start_at + interval '15 minutes'
  where meeting_type = 'tithing_declaration';
