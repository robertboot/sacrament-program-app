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
