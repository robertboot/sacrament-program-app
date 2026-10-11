"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyBishopric } from "@/lib/notifications";
import type { MeetingType } from "@/lib/supabase/types";
import type { CreateMeetingBlockInput } from "./types";

export async function toggleTithingDeclarations(enabled: boolean) {
  const sb = await createClient();
  const { error } = await sb
    .from("app_settings")
    .update({ tithing_declarations_enabled: enabled })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/calendar");
  revalidatePath("/");
  return { error: null };
}

export async function toggleCalendarEnabled(enabled: boolean) {
  const sb = await createClient();
  const { error } = await sb
    .from("app_settings")
    .update({ calendar_enabled: enabled })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/calendar");
  revalidatePath("/");
  return { error: null };
}

export async function regenerateBookingToken() {
  const sb = await createClient();
  const token = randomBytes(16).toString("hex");
  const { error } = await sb
    .from("app_settings")
    .update({ booking_token: token })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/calendar");
  return { error: null };
}

/**
 * Create either a one-off block (start_at + end_at set) or a recurring
 * block (recurrence_kind + recurrence_time + duration set). The input
 * union is defined in ./types so this file stays all-async-functions
 * for Next.js's "use server" restriction.
 */
export async function createMeetingBlock(input: CreateMeetingBlockInput) {
  const sb = await createClient();
  const base = { label: input.label };
  let row: Record<string, unknown>;
  if (input.kind === "one_off") {
    const start = new Date(input.start_at);
    const end = new Date(start.getTime() + input.duration_minutes * 60_000);
    row = {
      ...base,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      recurrence_kind: null,
    };
  } else if (input.kind === "weekly") {
    row = {
      ...base,
      recurrence_kind: "weekly",
      recurrence_day_of_week: input.day_of_week,
      recurrence_nth: null,
      recurrence_time: input.time,
      recurrence_duration_minutes: input.duration_minutes,
    };
  } else {
    row = {
      ...base,
      recurrence_kind: "monthly_nth",
      recurrence_day_of_week: input.day_of_week,
      recurrence_nth: input.nth,
      recurrence_time: input.time,
      recurrence_duration_minutes: input.duration_minutes,
    };
  }
  const { error } = await sb.from("meeting_blocks").insert(row);
  if (error) return { error: error.message };
  revalidatePath("/calendar");
  revalidatePath("/");
  return { error: null };
}

export async function deleteMeetingBlock(id: string) {
  const sb = await createClient();
  const { error } = await sb.from("meeting_blocks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/calendar");
  revalidatePath("/");
  return { error: null };
}

export async function cancelBooking(id: string) {
  const sb = await createClient();
  const { error } = await sb
    .from("meeting_bookings")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/calendar");
  revalidatePath("/");
  return { error: null };
}

/**
 * Public booking entry point — used by the no-login /book/[token] page.
 * Validates the token, re-checks that the chosen slot is still free
 * (someone else could've grabbed it between page load and submit), and
 * on success fires a bell notification to the bishopric. No RLS on the
 * table yet; the token is the gate.
 */
export async function createPublicBooking(
  token: string,
  input: {
    meeting_type: MeetingType;
    start_at: string;
    duration_minutes: number;
    member_name: string;
    member_email?: string;
  },
) {
  const { createServiceClient } = await import("@/lib/supabase/server");
  const sb = createServiceClient();
  const { data: settings } = await sb
    .from("app_settings")
    .select("booking_token, calendar_enabled, tithing_declarations_enabled")
    .eq("id", 1)
    .maybeSingle();
  const s = settings as
    | {
        booking_token: string | null;
        calendar_enabled: boolean;
        tithing_declarations_enabled: boolean;
      }
    | null;
  if (!s?.calendar_enabled) return { error: "Scheduling is not open right now." };
  if (!s.booking_token || s.booking_token !== token) {
    return { error: "This scheduling link is no longer valid." };
  }
  if (
    input.meeting_type === "tithing_declaration" &&
    !s.tithing_declarations_enabled
  ) {
    return { error: "Tithing declarations are not open right now." };
  }
  if (!input.member_name.trim()) return { error: "Please enter your name." };

  const start = new Date(input.start_at);
  const end = new Date(start.getTime() + input.duration_minutes * 60_000);

  // Re-check that nothing else landed on this slot while the member was
  // filling out the form. Overlap in SQL: start < existing.end AND
  // end > existing.start, scoped to confirmed bookings.
  const { data: clash } = await sb
    .from("meeting_bookings")
    .select("id")
    .eq("status", "confirmed")
    .lt("start_at", end.toISOString())
    .gt("end_at", start.toISOString())
    .limit(1);
  if (clash && clash.length > 0) {
    return { error: "That time was just booked — please pick another." };
  }

  const { data: booking, error } = await sb
    .from("meeting_bookings")
    .insert({
      meeting_type: input.meeting_type,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      member_name: input.member_name.trim(),
      member_email: input.member_email?.trim() || null,
      status: "confirmed",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const label = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  await notifyBishopric({
    type: "meeting_booked",
    title: `${input.member_name.trim()} booked a meeting — ${label}, ${time}`,
    body:
      input.meeting_type === "tithing_declaration"
        ? "Tithing declaration (15 min)"
        : input.meeting_type === "interview_60"
          ? "Interview (60 min)"
          : "Interview (30 min)",
    actionUrl: "/calendar",
  });

  revalidatePath("/calendar");
  revalidatePath("/");
  return { error: null, id: booking?.id as string };
}
