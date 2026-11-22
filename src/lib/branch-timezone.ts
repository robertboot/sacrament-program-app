/**
 * Hard-coded ward timezone for the Talladega Branch (Central Time —
 * America/Chicago honors DST so both CST and CDT work automatically).
 *
 * Used on the SERVER to format meeting times correctly: Vercel's Node
 * runtime has no TZ set and defaults to UTC, so a 12:15 PM CST booking
 * would render as "6:15 PM" without this. On the client, `Date`
 * formatters already use the browser's local TZ, so client components
 * don't need to pass this.
 *
 * When this app goes multi-tenant, move the value into app_settings
 * (per-ward column) and read it from there wherever `BRANCH_TIMEZONE`
 * is imported today.
 */
export const BRANCH_TIMEZONE = "America/Chicago";

/**
 * Format a timestamptz (Date or ISO string from the DB) as a short date
 * like "Sun, Nov 22" in the branch's timezone. Use for booking / event
 * timestamps wherever a date label appears alongside a time.
 */
export function formatTzDateShort(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: BRANCH_TIMEZONE,
  });
}

/** "Sunday, November 22, 2026" — the long-form date label. */
export function formatTzDateLong(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: BRANCH_TIMEZONE,
  });
}

/** "6:15 PM" — clock time in the branch's timezone. */
export function formatTzTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BRANCH_TIMEZONE,
  });
}

/** "Sun, Nov 22 at 6:15 PM" — combined label for notification bodies, lists, etc. */
export function formatTzDateTimeShort(iso: string | Date): string {
  return `${formatTzDateShort(iso)} at ${formatTzTime(iso)}`;
}

/**
 * Given a `YYYY-MM-DD` date and `HH:MM` wall clock the admin picked in
 * the branch timezone, return the UTC ISO instant that represents that
 * moment. Correct across DST transitions. Use this in place of
 * `new Date(\`${d}T${t}:00\`).toISOString()`, which only works when the
 * viewer's browser is itself in Central Time.
 *
 * How: construct a tentative UTC instant from the wall clock fields,
 * look up how many minutes Central Time is OFF UTC at that instant, and
 * shift the tentative instant by that offset. Handles CST (-6h) and
 * CDT (-5h) automatically because the offset is computed at runtime
 * for the exact date.
 */
export function wallClockInBranchTzToUtcIso(
  ymd: string,
  hhmm: string,
): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  // Tentative UTC: pretend the picked wall clock is already in UTC.
  const tentativeMs = Date.UTC(y, mo - 1, d, h, mi);
  const offsetMin = branchTzOffsetMinutesAt(new Date(tentativeMs));
  // Central offset is negative (behind UTC); real UTC = tentative - offset
  // e.g. tentative Nov 22 12:15Z, offset = -360, real = Nov 22 18:15Z
  return new Date(tentativeMs - offsetMin * 60_000).toISOString();
}

/**
 * How many minutes BRANCH_TIMEZONE is offset from UTC at the given
 * instant. Negative for Central Time (CST = -360, CDT = -300).
 */
function branchTzOffsetMinutesAt(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BRANCH_TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  // Intl may report hour "24" at midnight; normalize.
  const hr = parseInt(map.hour, 10) % 24;
  const centralAsUtcMs = Date.UTC(
    parseInt(map.year, 10),
    parseInt(map.month, 10) - 1,
    parseInt(map.day, 10),
    hr,
    parseInt(map.minute, 10),
    parseInt(map.second, 10),
  );
  return (centralAsUtcMs - instant.getTime()) / 60_000;
}
