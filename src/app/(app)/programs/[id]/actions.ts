"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notifyBishopric, notifyUsers } from "@/lib/notifications";
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
  // Step 2: clear just the speaker — keep the topic intact — and drop the
  // slot back to an unconfirmed draft so it must be reviewed + confirmed
  // again before re-entering the invite workflow.
  const { error: e2 } = await supabase
    .from("speaking_assignments")
    .update({
      speaker_id: null,
      custom_speaker_name: null,
      slot_confirmed: false,
    })
    .eq("id", assignmentId);
  if (e2) return { error: e2.message };
  revalidatePath(`/programs/${r1!.program_id}`);
  revalidatePath("/");
  return { error: null };
}

/**
 * Mark a slot as reviewed + finalized by the bishop. Only after this does
 * the invite workflow (text invite / mark asked / confirm / decline) open.
 *
 * If `promoteCustomTopic` is set and the slot has a typed one-off topic
 * (custom_topic_text, no topic_id), that text is also saved into the
 * topics table tagged with this slot's talk length so it's reusable
 * later, and the assignment is repointed at the new topic row.
 */
export async function confirmAssignmentSlot(
  assignmentId: string,
  promoteCustomTopic = false,
) {
  const supabase = await createClient();

  if (promoteCustomTopic) {
    const { data: a } = await supabase
      .from("speaking_assignments")
      .select("slot, topic_id, custom_topic_text")
      .eq("id", assignmentId)
      .single();
    const text = a?.custom_topic_text?.trim();
    if (a && !a.topic_id && text) {
      const category =
        a.slot === "first"
          ? "first"
          : a.slot === "concluding"
            ? "concluding"
            : "second";
      const { data: topic, error: tErr } = await supabase
        .from("topics")
        .insert({ title: text, is_active: true })
        .select("id")
        .single();
      if (tErr) return { error: tErr.message };
      const { error: tcErr } = await supabase
        .from("topic_categories")
        .insert({ topic_id: topic!.id, category });
      if (tcErr) return { error: tcErr.message };
      const { error: aErr } = await supabase
        .from("speaking_assignments")
        .update({ topic_id: topic!.id, custom_topic_text: null })
        .eq("id", assignmentId);
      if (aErr) return { error: aErr.message };
    }
  }

  const { data, error } = await supabase
    .from("speaking_assignments")
    .update({ slot_confirmed: true })
    .eq("id", assignmentId)
    .select("program_id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/programs/${data!.program_id}`);
  revalidatePath("/topics");
  revalidatePath("/");
  return { error: null };
}

/**
 * Auto-fill every still-draft slot on a program with a suggested speaker
 * and topic. Picks the longest-gap active speaker for the slot's category
 * and the longest-unused active topic for that category, avoiding anyone
 * already used elsewhere in this program. Does NOT confirm the slots — the
 * bishop reviews each pick and confirms manually.
 */
export async function autoGenerateProgram(programId: string) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: slots }, { data: speakers }, { data: topics }, { data: future }] =
    await Promise.all([
      supabase
        .from("speaking_assignments")
        .select("id, slot, speaker_id, topic_id, slot_confirmed")
        .eq("program_id", programId)
        .order("slot"),
      supabase
        .from("speakers")
        .select("id, last_spoke_date, is_active, speaker_categories(category)")
        .eq("is_active", true),
      supabase
        .from("topics")
        .select("id, last_used_date, is_active, topic_categories(category)")
        .eq("is_active", true),
      // Speakers already booked on any other upcoming program — skip them so
      // auto-generate doesn't double-book.
      supabase
        .from("speaking_assignments")
        .select("speaker_id, programs!inner(meeting_date)")
        .not("speaker_id", "is", null)
        .neq("status", "declined")
        .neq("program_id", programId)
        .gte("programs.meeting_date", today),
    ]);

  if (!slots) return { error: "Couldn't load the program." };

  const bookedElsewhere = new Set(
    (future ?? [])
      .map((r) => (r as { speaker_id: string | null }).speaker_id)
      .filter((x): x is string => !!x),
  );
  const usedSpeakerIds = new Set(
    slots.map((s) => s.speaker_id).filter((x): x is string => !!x),
  );
  const usedTopicIds = new Set(
    slots.map((s) => s.topic_id).filter((x): x is string => !!x),
  );

  type Cat = "first" | "second" | "concluding";
  const catFor = (slot: string): Cat[] =>
    slot === "first" ? ["first"] : ["second", "concluding"];

  function longestGap<
    T extends { id: string; last: string | null; cats: string[] },
  >(items: T[], allowed: string[], used: Set<string>): T | null {
    const pool = items
      .filter((i) => !used.has(i.id) && i.cats.some((c) => allowed.includes(c)))
      .sort((a, b) => {
        if (a.last === null && b.last === null) return a.id.localeCompare(b.id);
        if (a.last === null) return -1;
        if (b.last === null) return 1;
        return a.last.localeCompare(b.last);
      });
    return pool[0] ?? null;
  }

  const speakerPool = (speakers ?? []).map((s) => ({
    id: s.id as string,
    last: (s as { last_spoke_date: string | null }).last_spoke_date,
    cats: ((s.speaker_categories ?? []) as { category: string }[]).map(
      (c) => c.category,
    ),
  }));
  const topicPool = (topics ?? []).map((t) => ({
    id: t.id as string,
    last: (t as { last_used_date: string | null }).last_used_date,
    cats: ((t.topic_categories ?? []) as { category: string }[]).map(
      (c) => c.category,
    ),
  }));

  let filled = 0;
  for (const slot of slots) {
    if (slot.slot_confirmed) continue; // never overwrite a confirmed slot
    const allowed = catFor(slot.slot);
    const patch: { speaker_id?: string; topic_id?: string } = {};

    if (!slot.speaker_id) {
      const pick = longestGap(
        speakerPool,
        allowed,
        new Set([...usedSpeakerIds, ...bookedElsewhere]),
      );
      if (pick) {
        patch.speaker_id = pick.id;
        usedSpeakerIds.add(pick.id);
      }
    }
    if (!slot.topic_id) {
      const pick = longestGap(topicPool, allowed, usedTopicIds);
      if (pick) {
        patch.topic_id = pick.id;
        usedTopicIds.add(pick.id);
      }
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("speaking_assignments")
        .update(patch)
        .eq("id", slot.id);
      if (error) return { error: error.message };
      filled++;
    }
  }

  // If the unit has approval-required on and we actually filled slots,
  // ping the bishopric so the draft picks don't sit forgotten.
  if (filled > 0) {
    const { data: setting } = await supabase
      .from("app_settings")
      .select("require_speaker_approval")
      .eq("id", 1)
      .maybeSingle();
    if ((setting as { require_speaker_approval?: boolean } | null)?.require_speaker_approval) {
      const { data: prog } = await supabase
        .from("programs")
        .select("meeting_date")
        .eq("id", programId)
        .single();
      const meetingLabel = prog?.meeting_date
        ? new Date(prog.meeting_date + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })
        : "Sunday";
      await notifyBishopric({
        type: "slot_needs_approval",
        title: `${filled} slot${filled === 1 ? "" : "s"} awaiting approval — ${meetingLabel}`,
        body: "Auto-generate filled these as drafts. Review and approve.",
        actionUrl: `/programs/${programId}`,
      });
    }
  }

  revalidatePath(`/programs/${programId}`);
  revalidatePath("/");
  return { error: null, filled };
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
      .select("conducting_id, meeting_date")
      .eq("id", programId)
      .single();
    if (p?.conducting_id) {
      await supabase.rpc("recompute_bishopric_last_conducted", { p_profile_id: p.conducting_id });
    }

    // Ping choristers + counselors so they know the bulletin is live.
    // Senior leader (bishop) is excluded because they just clicked
    // Publish — the notification would only be noise.
    const admin = createServiceClient();
    const { data: recipients } = await admin
      .from("profiles")
      .select("id, role, bishopric_position")
      .or(
        "role.eq.chorister,and(role.eq.bishopric,bishopric_position.neq.bishop)",
      );
    const ids = ((recipients ?? []) as { id: string }[]).map((r) => r.id);
    const meetingLabel = p?.meeting_date
      ? new Date(p.meeting_date + "T00:00:00").toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
      : "Sunday";
    await notifyUsers(ids, {
      type: "program_published",
      title: `Program published for ${meetingLabel}`,
      body: null,
      actionUrl: `/programs/${programId}/view`,
    });
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
    first: "First speaker (about 5 min)",
    second: "Second speaker (about 10–15 min)",
    concluding: "Concluding speaker (about 15 min)",
  };
  const meetingDate = new Date(program!.meeting_date + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" },
  );
  const topicText = topic?.title ?? a.custom_topic_text ?? "(no topic yet)";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sacrament-program-app.vercel.app";
  const link = `${siteUrl}/c/${a.confirm_token}`;

  // Labeled lines so date / slot / topic stand out on a small SMS
  // preview instead of being buried in a paragraph.
  const body = [
    `Hi ${speaker.full_name},`,
    `Would you be willing to speak in sacrament meeting?`,
    [
      `Date: ${meetingDate}`,
      `Slot: ${slotLabel[a.slot] ?? a.slot}`,
      `Topic: ${topicText}`,
    ].join("\n"),
    `Please tap to respond: ${link}`,
    `Or reply Y to accept, N to decline. If declining, feel free to share a reason.`,
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
