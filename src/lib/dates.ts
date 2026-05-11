import { differenceInWeeks, format, parseISO, startOfDay } from "date-fns";

/** ISO date string (YYYY-MM-DD) → human "X weeks ago" / "Never". */
export function weeksSinceLabel(isoDate: string | null): string {
  if (!isoDate) return "Never";
  const date = parseISO(isoDate);
  const weeks = differenceInWeeks(startOfDay(new Date()), startOfDay(date));
  if (weeks < 1) return "This week";
  if (weeks === 1) return "1 week ago";
  return `${weeks} weeks ago`;
}

export function weeksSince(isoDate: string | null): number | null {
  if (!isoDate) return null;
  return differenceInWeeks(startOfDay(new Date()), startOfDay(parseISO(isoDate)));
}

/** Traffic-light tier for rotation freshness on the picker. */
export type RotationTier = "fresh" | "caution" | "stale";

export function rotationTier(isoDate: string | null): RotationTier {
  const w = weeksSince(isoDate);
  if (w === null || w >= 8) return "fresh"; // green
  if (w >= 4) return "caution"; // yellow
  return "stale"; // red
}

export function formatMeetingDate(iso: string): string {
  return format(parseISO(iso), "EEEE, MMMM d, yyyy");
}

export function formatMeetingDateShort(iso: string): string {
  return format(parseISO(iso), "MMM d");
}

/** Next Sunday on or after the given date (or today, default). */
export function nextSundayISO(from: Date = new Date()): string {
  const d = new Date(from);
  const dow = d.getDay();
  const offset = (7 - dow) % 7;
  d.setDate(d.getDate() + offset);
  return format(d, "yyyy-MM-dd");
}
