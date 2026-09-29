/**
 * Due-date logic. All date math is calendar-day, local time.
 * Dates are plain `YYYY-MM-DD` strings end to end — parsed into UTC
 * timestamps purely for arithmetic so DST can never shift a day.
 */

export type DueStatus = "never" | "overdue" | "soon" | "current" | "none";

export const DUE_SOON_DAYS = 30;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtcMs(iso: string): number {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${iso}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUtcMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear().toString().padStart(4, "0");
  const mo = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = d.getUTCDate().toString().padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** Today as YYYY-MM-DD in the device's local calendar. */
export function todayLocal(now: Date = new Date()): string {
  const y = now.getFullYear().toString().padStart(4, "0");
  const mo = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

/** Calendar-day addition: addDays("2026-01-31", 1) === "2026-02-01". */
export function addDays(iso: string, days: number): string {
  return fromUtcMs(toUtcMs(iso) + days * 86_400_000);
}

/** Whole calendar days from `a` to `b`; positive when `b` is later. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000);
}

/**
 * next_due for a dose, computed at write time.
 * Null interval means one-time / history only — no due date.
 */
export function computeNextDue(
  givenOn: string,
  intervalDays: number | null
): string | null {
  if (intervalDays == null) return null;
  return addDays(givenOn, intervalDays);
}

export interface DueState {
  status: DueStatus;
  /** Days overdue when status is "overdue"; days until due when "soon" or "current". */
  days: number | null;
  nextDue: string | null;
  lastGiven: string | null;
}

/**
 * Status of one schedule from its most recent record.
 *
 * - No record ever            → "never" (sorts above everything)
 * - next_due before today     → "overdue" (days = how many days past)
 * - next_due within 30 days   → "soon"    (days = how many days out; 0 = today)
 * - further out               → "current"
 * - interval null / no due    → "none" (history only, no reminder)
 */
export function dueState(
  lastRecord: { given_on: string; next_due: string | null } | null,
  today: string
): DueState {
  if (!lastRecord) {
    return { status: "never", days: null, nextDue: null, lastGiven: null };
  }
  const { given_on, next_due } = lastRecord;
  if (next_due == null) {
    return { status: "none", days: null, nextDue: null, lastGiven: given_on };
  }
  const until = daysBetween(today, next_due);
  if (until < 0) {
    return { status: "overdue", days: -until, nextDue: next_due, lastGiven: given_on };
  }
  if (until <= DUE_SOON_DAYS) {
    return { status: "soon", days: until, nextDue: next_due, lastGiven: given_on };
  }
  return { status: "current", days: until, nextDue: next_due, lastGiven: given_on };
}

const STATUS_ORDER: Record<DueStatus, number> = {
  never: 0,
  overdue: 1,
  soon: 2,
  current: 3,
  none: 4,
};

/**
 * Sort comparator for schedule rows: never-logged first, then most
 * overdue, then soonest due, then current by date, history-only last.
 */
export function compareDueStates(a: DueState, b: DueState): number {
  const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (byStatus !== 0) return byStatus;
  if (a.status === "overdue") return (b.days ?? 0) - (a.days ?? 0);
  if (a.status === "soon" || a.status === "current") {
    return (a.days ?? 0) - (b.days ?? 0);
  }
  return 0;
}

/** Human label for a status, shown next to the color border — never color alone. */
export function statusLabel(state: DueState): string {
  switch (state.status) {
    case "never":
      return "Never logged";
    case "overdue":
      return state.days === 1 ? "1 day overdue" : `${state.days} days overdue`;
    case "soon":
      if (state.days === 0) return "Due today";
      return state.days === 1 ? "Due tomorrow" : `Due in ${state.days} days`;
    case "current":
      return "Current";
    case "none":
      return "No reminder";
  }
}
