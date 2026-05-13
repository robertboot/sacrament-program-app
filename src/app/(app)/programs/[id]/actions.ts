"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AssignmentStatus, MeetingType, ProgramStatus } from "@/lib/supabase/types";

type ProgramFields = {
  presiding?: string | null;
  conducting_id?: string | null;
  welcome_text?: string | null;
  brief_reminders?: string | null;
  opening_hymn_id?: number | null;
  sacrament_hymn_id?: number | null;
  intermediate_hymn_id?: number | null;
  intermediate_hymn_text?: string | null;
  closing_hymn_id?: number | null;
  invocation?: string | null;
  benediction?: string | null;
  chorister?: string | null;
  organist?: string | null;
  releases?: string | null;
  sustainings?: string | null;
  move_in_welcomes?: string | null;
  aaronic_sustainings?: string | null;
  baptism_confirmation?: string | null;
  baby_blessing?: string | null;
  stake_business?: string | null;
  ward_business_releases?: boolean;
  ward_business_sustainings?: boolean;
  ward_business_move_in_welcomes?: boolean;
  ward_business_aaronic_sustainings?: boolean;
  ward_business_baptism_confirmation?: boolean;
  ward_business_baby_blessing?: boolean;
  meeting_type?: MeetingType;
  meeting_type_label?: string | null;
};

export async function updateProgramFields(programId: string, fields: ProgramFields) {
  const supabase = await createClient();
  const { error } = await supabase.from("programs").update(fields).eq("id", programId);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${programId}`);
  revalidatePath("/");
  return { error: null };
}

export async function updateAssignmentSpeakerTopic(
  assignmentId: string,
  data: {
    speaker_id: string | null;
    custom_speaker_name?: string | null;
    topic_id: string | null;
    custom_topic_text: string | null;
    length_minutes?: number;
    notes?: string | null;
  },
) {
  const supabase = await createClient();
  const { error, data: row } = await supabase
    .from("speaking_assignments")
    .update(data)
    .eq("id", assignmentId)
    .select("program_id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/programs/${row!.program_id}`);
  revalidatePath("/");
  return { error: null };
}

export async function updateAssignmentStatus(
  assignmentId: string,
  newStatus: AssignmentStatus,
) {
  const supabase = await createClient();
  const { error, data: row } = await supabase
    .from("speaking_assignments")
    .update({ status: newStatus })
    .eq("id", assignmentId)
    .select("program_id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/programs/${row!.program_id}`);
  revalidatePath("/");
  return { error: null };
}

/**
 * Reset a slot: clear the speaker and return them to circulation, status →
 * not_yet_asked. The topic is preserved so the bishop can pick a new speaker
 * without retyping or re-selecting the assignment topic. The guard trigger
 * normally prevents speaker changes once status > not_yet_asked, so we set
 * status first.
 */
export async function resetAssignmentSlot(assignmentId: string) {
  const supabase = await createClient();
  // Step 1: move back to not_yet_asked. (Trigger clears timestamps.)
  const { error: e1, data: r1 } = await supabase
    .from("speaking_assignments")
    .update({ status: "not_yet_asked" })
    .eq("id", assignmentId)
    .select("program_id")
    .single();
  if (e1) return { error: e1.message };
  // Step 2: clear just the speaker — keep the topic intact.
  const { error: e2 } = await supabase
    .from("speaking_assignments")
    .update({
      speaker_id: null,
      custom_speaker_name: null,
    })
    .eq("id", assignmentId);
  if (e2) return { error: e2.message };
  revalidatePath(`/programs/${r1!.program_id}`);
  revalidatePath("/");
  return { error: null };
}

/**
 * Clear just the speaker_id on a not_yet_asked assignment, preserving the topic.
 * Used by the conflict dialog when "Move to this date" yanks the speaker from a
 * pending future slot — we keep the topic in place so the slot is ready for the
 * next person.
 */
/**
 * Insert any missing first/second/concluding speaking_assignment rows for the
 * given program. Idempotent — only adds slots that don't already exist. Used
 * when a program was created without speaker slots (e.g. seeded as "Speakers
 * TBD") and the bishop now wants to assign speakers.
 */
export async function ensureProgramSlots(programId: string) {
  const supabase = await createClient();
  const { data: existing, error: selErr } = await supabase
    .from("speaking_assignments")
    .select("slot")
    .eq("program_id", programId);
  if (selErr) return { error: selErr.message, created: 0 };
  const existingSlots = new Set((existing ?? []).map((r) => r.slot));
  const toInsert: { program_id: string; slot: string; length_minutes: number }[] = [];
  if (!existingSlots.has("first"))
    toInsert.push({ program_id: programId, slot: "first", length_minutes: 5 });
  if (!existingSlots.has("second"))
    toInsert.push({ program_id: programId, slot: "second", length_minutes: 10 });
  if (!existingSlots.has("concluding"))
    toInsert.push({ program_id: programId, slot: "concluding", length_minutes: 15 });
  if (toInsert.length === 0) return { error: null, created: 0 };
  const { error } = await supabase.from("speaking_assignments").insert(toInsert);
  if (error) return { error: error.message, created: 0 };
  revalidatePath(`/programs/${programId}`);
  revalidatePath("/");
  return { error: null, created: toInsert.length };
}

export async function clearAssignmentSpeaker(assignmentId: string) {
  const supabase = await createClient();
  const { error, data } = await supabase
    .from("speaking_assignments")
    .update({ speaker_id: null, custom_speaker_name: null })
    .eq("id", assignmentId)
    .select("program_id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/programs/${data!.program_id}`);
  revalidatePath("/");
  return { error: null };
}

export async function setProgramStatus(programId: string, status: ProgramStatus) {
  const supabase = await createClient();

  // Enforce: programs can only be published during the meeting's week — defined
  // as the meeting date itself or any of the 6 days before it. Prevents the
  // bishop from accidentally publishing a draft for next month.
  if (status === "published") {
    const { data: p } = await supabase
      .from("programs")
      .select("meeting_date")
      .eq("id", programId)
      .single();
    if (p?.meeting_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const meeting = new Date(p.meeting_date + "T00:00:00");
      const diffDays = Math.round(
        (meeting.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays > 6) {
        const openDate = new Date(meeting);
        openDate.setDate(openDate.getDate() - 6);
        const fmt = openDate.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        return {
          error: `Too early to publish. Publishing opens ${fmt} (6 days before the meeting).`,
        };
      }
    }
  }

  const { error } = await supabase.from("programs").update({ status }).eq("id", programId);
  if (error) return { error: error.message };

  if (status === "published") {
    // Refresh conductor's last_conducted_date (some bishopric flows publish day-of).
    const { data: p } = await supabase
      .from("programs")
      .select("conducting_id")
      .eq("id", programId)
      .single();
    if (p?.conducting_id) {
      await supabase.rpc("recompute_bishopric_last_conducted", { p_profile_id: p.conducting_id });
    }
  }
  revalidatePath(`/programs/${programId}`);
  revalidatePath("/");
  return { error: null };
}

export async function regenerateShareToken(programId: string) {
  const supabase = await createClient();
  const token = crypto.randomUUID().replace(/-/g, "");
  const { error } = await supabase
    .from("programs")
    .update({ share_token: token })
    .eq("id", programId);
  if (error) return { error: error.message, token: null };
  revalidatePath(`/programs/${programId}`);
  return { error: null, token };
}

export async function deleteProgram(programId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("programs").delete().eq("id", programId);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { error: null };
}

/**
 * Send the speaker an SMS invite with a self-confirm link. Requires the
 * speaker to have a phone number on file and Twilio env vars to be set.
 * Moves the assignment to awaiting_confirmation on success.
 */
export async function sendAssignmentInvite(assignmentId: string) {
  const supabase = await createClient();

  const { data: a, error } = await supabase
    .from("speaking_assignments")
    .select(
      `id, slot, length_minutes, confirm_token, program_id,
       speaker:speakers(full_name, phone),
       topic:topics(title),
       custom_topic_text,
       program:programs(meeting_date)`,
    )
    .eq("id", assignmentId)
    .single();
  if (error || !a) return { error: error?.message ?? "Assignment not found." };

  const speaker = Array.isArray(a.speaker) ? a.speaker[0] : a.speaker;
  const topic = Array.isArray(a.topic) ? a.topic[0] : a.topic;
  const program = Array.isArray(a.program) ? a.program[0] : a.program;
  if (!speaker?.phone) return { error: "Speaker has no phone number on file." };

  const slotLabel: Record<string, string> = {
    first: "first speaker (5 min)",
    second: "second speaker (10–15 min)",
    concluding: "concluding speaker (15 min)",
  };
  const meetingDate = new Date(program!.meeting_date + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" },
  );
  const topicText = topic?.title ?? a.custom_topic_text ?? "(no topic yet)";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sacrament-program-app.vercel.app";
  const link = `${siteUrl}/c/${a.confirm_token}`;

  const body = [
    `Hi ${speaker.full_name},`,
    `Would you be willing to be a speaker in sacrament meeting on ${meetingDate} as ${slotLabel[a.slot] ?? a.slot}?`,
    `Topic: ${topicText}`,
    `Please tap to respond: ${link}`,
  ].join("\n\n");

  const { sendSms } = await import("@/lib/sms");
  const result = await sendSms(speaker.phone, body);
  if (!result.ok) return { error: result.error };

  const { error: ue } = await supabase
    .from("speaking_assignments")
    .update({ status: "awaiting_confirmation", invited_at: new Date().toISOString() })
    .eq("id", assignmentId);
  if (ue) return { error: ue.message };

  revalidatePath(`/programs/${a.program_id}`);
  revalidatePath("/");
  return { error: null };
}
