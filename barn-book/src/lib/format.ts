import type { DueStatus } from "./due";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-09-01" → "Sep 1, 2026" without ever constructing a Date. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

/** 4px left border carrying status — always paired with a text label. */
export const STATUS_BORDER: Record<DueStatus, string> = {
  never: "border-l-brass",
  overdue: "border-l-overdue",
  soon: "border-l-soon",
  current: "border-l-current",
  none: "border-l-line",
};

export const STATUS_TEXT: Record<DueStatus, string> = {
  never: "text-brass",
  overdue: "text-overdue",
  soon: "text-soon",
  current: "text-current",
  none: "text-soft",
};
