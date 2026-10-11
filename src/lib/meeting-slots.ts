import type { MeetingBlock, MeetingType } from "@/lib/supabase/types";

/**
 * Member-facing booking windows. Hard-coded for v1 — if the ward wants
 * different hours they tell us and we move them. All times are in the
 * ward's local timezone (we assume admin and member share one, same as
 * the rest of the app). Day indices follow JS Date.getDay() — 0 = Sun.
 */
export const BOOKING_WINDOWS: Array<{
  dayOfWeek: number;
  start: string;  // "HH:MM" local
  end: string;    // exclusive
}> = [
  { dayOfWeek: 0, start: "12:15", end: "14:00" },  // Sunday after sacrament
  { dayOfWeek: 3, start: "19:30", end: "20:00" },  // Wednesday evening
];

/** Minutes of empty space enforced between every meeting / block. */
export const BUFFER_MINUTES = 5;

/** How many weeks forward the public page offers. */
export const BOOKING_HORIZON_WEEKS = 8;

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  interview_30: "Interview (30 min)",
  interview_60: "Interview (60 min)",
  tithing_declaration: "Tithing declaration (15 min)",
};

export const MEETING_TYPE_DURATION_MIN: Record<MeetingType, number> = {
  interview_30: 30,
  interview_60: 60,
  tithing_declaration: 15,
};

/** Tithing declarations are seasonal (Sep 1 → Nov 30). */
export function isInTithingSeason(d: Date): boolean {
  const m = d.getMonth(); // 0-indexed
  return m >= 8 && m <= 10; // Sep..Nov
}

type OccupiedRange = { startMs: number; endMs: number };

/**
 * Expand a MeetingBlock into concrete time ranges that fall on `date`.
 * One-off blocks produce 0 or 1 ranges; recurring blocks produce 0 or 1
 * depending on whether the recurrence pattern fires on that date.
 *
 * `date` here is anchored at local midnight of the target day — pass
 * the SAME zero-time Date you're using for slot generation.
 */
export function expandBlockForDate(
  block: MeetingBlock,
  date: Date,
): OccupiedRange | null {
  const dayOfWeek = date.getDay();
  if (block.recurrence_kind === null) {
    if (!block.start_at || !block.end_at) return null;
    const startMs = new Date(block.start_at).getTime();
    const endMs = new Date(block.end_at).getTime();
    const dayStart = date.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    if (startMs >= dayEnd || endMs <= dayStart) return null;
    return { startMs, endMs };
  }
  if (block.recurrence_day_of_week !== dayOfWeek) return null;
  if (block.recurrence_kind === "monthly_nth") {
    const nth = Math.ceil(date.getDate() / 7);
    if (nth !== block.recurrence_nth) return null;
  }
  const [hh, mm] = (block.recurrence_time ?? "00:00").split(":").map(Number);
  const startMs = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hh,
    mm,
  ).getTime();
  const endMs = startMs + (block.recurrence_duration_minutes ?? 0) * 60_000;
  return { startMs, endMs };
}

/**
 * Return the "HH:MM" start times a member can book on `date` for a
 * meeting of `durationMin`, given everything already on the schedule
 * for that day (blocks + existing bookings) and the 5-min buffer.
 *
 * Slots are generated in 5-minute increments inside the window so a
 * 30-min appointment can start at 12:15, 12:20, 12:25, … within the
 * Sunday window. Any slot that would overlap an occupied range —
 * padded by BUFFER_MINUTES on each side — is dropped.
 */
export function availableSlotsForDate(
  date: Date,
  durationMin: number,
  blocks: MeetingBlock[],
  bookingsThatDay: Array<{ start_at: string; end_at: string }>,
): string[] {
  const dayOfWeek = date.getDay();
  const windows = BOOKING_WINDOWS.filter((w) => w.dayOfWeek === dayOfWeek);
  if (windows.length === 0) return [];

  const occupied: OccupiedRange[] = [];
  for (const b of blocks) {
    const r = expandBlockForDate(b, date);
    if (r) occupied.push(r);
  }
  for (const b of bookingsThatDay) {
    occupied.push({
      startMs: new Date(b.start_at).getTime(),
      endMs: new Date(b.end_at).getTime(),
    });
  }

  const bufferMs = BUFFER_MINUTES * 60_000;
  const durationMs = durationMin * 60_000;
  const stepMs = 5 * 60_000;

  function overlaps(startMs: number, endMs: number): boolean {
    for (const o of occupied) {
      if (startMs < o.endMs + bufferMs && endMs + bufferMs > o.startMs) {
        return true;
      }
    }
    return false;
  }

  const out: string[] = [];
  for (const w of windows) {
    const [sh, sm] = w.start.split(":").map(Number);
    const [eh, em] = w.end.split(":").map(Number);
    const windowStart = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      sh,
      sm,
    ).getTime();
    const windowEnd = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      eh,
      em,
    ).getTime();
    for (let t = windowStart; t + durationMs <= windowEnd; t += stepMs) {
      if (!overlaps(t, t + durationMs)) {
        const d = new Date(t);
        const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        out.push(hhmm);
      }
    }
  }
  return out;
}

/**
 * Candidate booking dates for the horizon. Returns `yyyy-MM-dd` strings
 * for the next BOOKING_HORIZON_WEEKS worth of Sundays + Wednesdays,
 * excluding dates in `blockedDates` (used by the caller to drop
 * no_services Sundays).
 */
export function candidateDates(
  from: Date,
  blockedDates: Set<string> = new Set(),
): string[] {
  const out: string[] = [];
  for (let i = 0; i < BOOKING_HORIZON_WEEKS * 7; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const dow = d.getDay();
    const isBookingDay = BOOKING_WINDOWS.some((w) => w.dayOfWeek === dow);
    if (!isBookingDay) continue;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (blockedDates.has(iso)) continue;
    out.push(iso);
  }
  return out;
}
