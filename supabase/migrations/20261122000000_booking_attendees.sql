-- Freeform "additional attendees" text on each meeting booking so the
-- bishopric can note who else is coming with the member who booked
-- (spouse, child, parent, companion, etc.) without inventing a
-- multi-member schema. Used by the new Edit-booking dialog in the
-- Calendar tab.
alter table meeting_bookings
  add column if not exists additional_attendees text;
