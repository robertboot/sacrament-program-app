import type { MeetingBlockRecurrenceKind } from "@/lib/supabase/types";

/**
 * Tagged-union input for createMeetingBlock(). Lives here (not in
 * actions.ts) because "use server" files should only export async
 * functions — Next.js is strict about non-function exports.
 */
export type CreateMeetingBlockInput =
  | {
      kind: "one_off";
      label: string;
      start_at: string;
      duration_minutes: number;
    }
  | {
      kind: "weekly";
      label: string;
      day_of_week: number;
      time: string;
      duration_minutes: number;
    }
  | {
      kind: "monthly_nth";
      label: string;
      day_of_week: number;
      nth: number;
      time: string;
      duration_minutes: number;
    };

export type { MeetingBlockRecurrenceKind };
