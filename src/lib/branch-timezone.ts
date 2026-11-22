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
