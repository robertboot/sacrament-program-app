import type { AssignmentSlot, AssignmentStatus } from "./supabase/types";

export const SLOT_LABELS: Record<AssignmentSlot, string> = {
  first: "First Speaker",
  second: "Second Speaker",
  concluding: "Closing Speaker",
};

export const SLOT_DEFAULT_MINUTES: Record<AssignmentSlot, number> = {
  first: 5,
  second: 10,
  concluding: 15,
};

export const STATUS_LABELS: Record<AssignmentStatus, string> = {
  not_yet_asked: "Not yet asked",
  awaiting_confirmation: "Awaiting confirmation",
  confirmed: "Confirmed",
  declined: "Declined",
};

// One-line, action-oriented hint rendered directly under the status
// bubble on the dashboard and the editor's speaker rows. Kept short so
// it stays out of the way visually.
export const STATUS_HINT: Record<AssignmentStatus, string> = {
  not_yet_asked: "needs asking",
  awaiting_confirmation: "waiting on reply",
  confirmed: "all set",
  declined: "declined",
};

export type StatusTone = "black" | "yellow" | "green" | "red";

export const STATUS_TONE: Record<AssignmentStatus, StatusTone> = {
  not_yet_asked: "black",
  awaiting_confirmation: "yellow",
  confirmed: "green",
  declined: "red",
};

export const STATUS_DOT_CLASS: Record<StatusTone, string> = {
  black: "bg-zinc-900 dark:bg-zinc-100",
  yellow: "bg-yellow-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
};

export const STATUS_PILL_CLASS: Record<StatusTone, string> = {
  black:
    "bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700",
  yellow:
    "bg-yellow-50 text-yellow-900 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-100 dark:border-yellow-800",
  green:
    "bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800",
  red: "bg-red-50 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-100 dark:border-red-800",
};

export const SLOT_ORDER: AssignmentSlot[] = ["first", "second", "concluding"];

export function slotIndex(slot: AssignmentSlot): number {
  return SLOT_ORDER.indexOf(slot);
}
