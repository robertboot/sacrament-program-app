"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyBishopric } from "@/lib/notifications";

/** Look up the assignment behind a confirm token — used to build a
 *  notification body that names the speaker + meeting date once the
 *  response has been recorded. Returns null on any lookup miss so the
 *  main response flow never fails on notification bookkeeping. */
async function lookupForNotification(token: string) {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("speaking_assignments")
      .select(
        `program_id, meeting_date:programs!inner(meeting_date),
         speaker:speakers(full_name)`,
      )
      .eq("confirm_token", token)
      .maybeSingle();
    if (!data) return null;
    const meetingDate = Array.isArray(data.meeting_date)
      ? (data.meeting_date[0] as { meeting_date: string } | undefined)?.meeting_date
      : (data.meeting_date as { meeting_date: string } | null)?.meeting_date;
    const speaker = Array.isArray(data.speaker)
      ? (data.speaker[0] as { full_name: string } | undefined)?.full_name
      : (data.speaker as { full_name: string } | null)?.full_name;
    return {
      programId: data.program_id as string,
      meetingDate: meetingDate ?? null,
      speakerName: speaker ?? "A speaker",
    };
  } catch {
    return null;
  }
}

function formatMeetingDate(iso: string | null): string {
  if (!iso) return "Sunday";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export async function respondToAssignment(
  token: string,
  response: "confirmed" | "declined",
  reason?: string | null,
) {
  const sb = createServiceClient();
  const trimmed = (reason ?? "").trim();
  const { data, error } = await sb.rpc("respond_to_assignment", {
    p_token: token,
    p_response: response,
    p_reason: response === "declined" && trimmed ? trimmed : null,
  });
  if (error) return { error: error.message };
  const payload = data as { ok: boolean; error?: string; status?: string };
  if (!payload.ok) return { error: payload.error ?? "Could not record response." };

  // Ping the bishopric so they see the reply on the bell.
  const info = await lookupForNotification(token);
  if (info) {
    const label = formatMeetingDate(info.meetingDate);
    if (response === "confirmed") {
      await notifyBishopric({
        type: "speaker_confirmed",
        title: `${info.speakerName} confirmed for ${label}`,
        actionUrl: `/programs/${info.programId}`,
      });
    } else {
      await notifyBishopric({
        type: "speaker_declined",
        title: `${info.speakerName} declined for ${label}`,
        body: trimmed
          ? `Reason: ${trimmed}`
          : "You'll want to line up a replacement.",
        actionUrl: `/programs/${info.programId}`,
      });
    }
  }

  revalidatePath(`/c/${token}`);
  revalidatePath("/");
  return { error: null };
}

/**
 * Add or update a decline reason after the initial decline was recorded
 * without one — used by the web page's "add a reason" secondary state.
 * Fires an updated notification so the bishopric sees the reason arrive.
 */
export async function updateDeclineReason(token: string, reason: string) {
  const sb = createServiceClient();
  const trimmed = reason.trim();
  if (!trimmed) return { error: "Reason cannot be empty." };
  const { data, error } = await sb.rpc("set_decline_reason", {
    p_token: token,
    p_reason: trimmed,
  });
  if (error) return { error: error.message };
  const payload = data as { ok: boolean; error?: string };
  if (!payload.ok) return { error: payload.error ?? "Could not save reason." };

  const info = await lookupForNotification(token);
  if (info) {
    await notifyBishopric({
      type: "speaker_declined",
      title: `${info.speakerName} shared a reason for declining`,
      body: `Reason: ${trimmed}`,
      actionUrl: `/programs/${info.programId}`,
    });
  }

  revalidatePath(`/c/${token}`);
  revalidatePath("/");
  return { error: null };
}
