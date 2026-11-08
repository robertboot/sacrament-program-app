"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { monthAfter, monthName, planningMonthFor } from "@/lib/fsy-lessons";
import { getFsyLesson } from "@/lib/fsy-lessons-server";
import type { CouncilKind, CouncilMeeting } from "@/lib/supabase/types";

/**
 * Pick a default date for a new meeting based on kind:
 *  - BC: next 2nd or 4th Sunday 9:00 AM (schedule change made Oct 2026).
 *  - BYC: 2nd Sunday of the following month (fits the 3rd-Wednesday
 *    activity planning cadence the youth council uses).
 */
function nextDefaultDate(kind: CouncilKind): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (kind === "branch_council") {
    // Walk forward until a 2nd or 4th Sunday on/after today.
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (d.getDay() !== 0) continue;
      const nth = Math.ceil(d.getDate() / 7);
      if (nth === 2 || nth === 4) return isoDate(d);
    }
  } else {
    // BYC — 2nd Sunday of this month if we haven't passed it, else next month.
    const thisMonthSecond = nthSundayOfMonth(today.getFullYear(), today.getMonth(), 2);
    if (thisMonthSecond >= today) return isoDate(thisMonthSecond);
    return isoDate(
      nthSundayOfMonth(today.getFullYear(), today.getMonth() + 1, 2),
    );
  }
  return isoDate(today);
}

function nthSundayOfMonth(year: number, monthZeroIndexed: number, nth: number): Date {
  const first = new Date(year, monthZeroIndexed, 1);
  const firstSundayDay = 1 + ((7 - first.getDay()) % 7);
  return new Date(year, monthZeroIndexed, firstSundayDay + (nth - 1) * 7);
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function createCouncilMeeting(input: {
  kind: CouncilKind;
  meeting_date?: string;
}) {
  const sb = await createClient();
  const meeting_date = input.meeting_date ?? nextDefaultDate(input.kind);

  // Base row — BC only populates meeting_date + kind; BYC also auto-fills
  // theme/scripture/pages/ideas and the 3rd-Wednesday activity_date, plus
  // a Looking-Ahead line pointing at next month's FSY chapter. All of
  // these remain editable in the editor; failed FSY fetches still create
  // the agenda, they just leave the theme fields null for the render to
  // show a "(verify)" placeholder.
  const row: Record<string, unknown> = { kind: input.kind, meeting_date };

  if (input.kind === "byc") {
    const anchor = new Date(meeting_date + "T00:00:00");
    const planning = planningMonthFor(anchor);
    const fsy = await getFsyLesson(planning.year, planning.month);
    const ideas = [fsy?.idea_a, fsy?.idea_b].filter(Boolean).join(" · ");
    row.activity_date = isoDate(planning.thirdWednesday);
    row.theme = fsy?.chapter_title ?? null;
    row.theme_scripture = fsy?.scripture ?? null;
    row.theme_pages = fsy?.pages ?? null;
    row.activity_ideas = ideas || null;

    const next = monthAfter(planning.year, planning.month);
    const nextFsy = await getFsyLesson(next.year, next.month);
    if (nextFsy?.chapter_title) {
      row.looking_ahead_text = `${monthName(next.month)} theme — "${nextFsy.chapter_title}"\nActivity Wed, ${formatShort(next.thirdWednesday)} — plan at the next BYC`;
    }
  }

  const { data, error } = await sb
    .from("council_meetings")
    .insert(row)
    .select("id")
    .single();
  if (error) return { error: error.message, id: null };
  revalidatePath("/councils");
  return { error: null, id: data?.id as string };
}

function formatShort(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Re-fetch the FSY lesson for this BYC's planning month and overwrite
 * theme/scripture/pages/ideas, the 3rd-Wednesday activity_date, and the
 * Looking-Ahead line. Called from the editor's "Refresh theme" button.
 * Safe to call on a BC — becomes a no-op and returns a friendly error.
 */
export async function refreshBycTheme(meetingId: string) {
  const sb = await createClient();
  const { data: m } = await sb
    .from("council_meetings")
    .select("id, kind, meeting_date")
    .eq("id", meetingId)
    .maybeSingle();
  if (!m) return { error: "Meeting not found." };
  const meeting = m as { id: string; kind: CouncilKind; meeting_date: string };
  if (meeting.kind !== "byc") {
    return { error: "Only BYC agendas pull from the FSY lesson pages." };
  }
  const planning = planningMonthFor(new Date(meeting.meeting_date + "T00:00:00"));
  const fsy = await getFsyLesson(planning.year, planning.month);
  const ideas = [fsy?.idea_a, fsy?.idea_b].filter(Boolean).join(" · ");
  const next = monthAfter(planning.year, planning.month);
  const nextFsy = await getFsyLesson(next.year, next.month);
  const lookingAhead = nextFsy?.chapter_title
    ? `${monthName(next.month)} theme — "${nextFsy.chapter_title}"\nActivity Wed, ${formatShort(next.thirdWednesday)} — plan at the next BYC`
    : null;
  const { error } = await sb
    .from("council_meetings")
    .update({
      activity_date: isoDate(planning.thirdWednesday),
      theme: fsy?.chapter_title ?? null,
      theme_scripture: fsy?.scripture ?? null,
      theme_pages: fsy?.pages ?? null,
      activity_ideas: ideas || null,
      looking_ahead_text: lookingAhead,
      updated_at: new Date().toISOString(),
    })
    .eq("id", meetingId);
  if (error) return { error: error.message };
  revalidatePath(`/councils/${meetingId}`);
  return { error: null, hit: !!fsy };
}

export async function updateCouncilMeeting(
  id: string,
  patch: Partial<Omit<CouncilMeeting, "id" | "created_at" | "share_token">>,
) {
  const sb = await createClient();
  const { error } = await sb
    .from("council_meetings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/councils");
  revalidatePath(`/councils/${id}`);
  return { error: null };
}

export async function deleteCouncilMeeting(id: string) {
  const sb = await createClient();
  const { error } = await sb.from("council_meetings").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/councils");
  return { error: null };
}

export async function regenerateCouncilShareToken(id: string) {
  const sb = await createClient();
  const token = randomBytes(16).toString("hex");
  const { error } = await sb
    .from("council_meetings")
    .update({ share_token: token, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/councils/${id}`);
  return { error: null, token };
}

export async function addAgendaItem(meetingId: string) {
  const sb = await createClient();
  const { data: existing } = await sb
    .from("council_agenda_items")
    .select("position")
    .eq("meeting_id", meetingId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = ((existing?.position as number | undefined) ?? 0) + 1;
  const { data, error } = await sb
    .from("council_agenda_items")
    .insert({ meeting_id: meetingId, position: nextPosition, title: "" })
    .select("id")
    .single();
  if (error) return { error: error.message, id: null };
  revalidatePath(`/councils/${meetingId}`);
  return { error: null, id: data?.id as string };
}

export async function updateAgendaItem(
  id: string,
  patch: { title?: string; sub_note?: string | null; position?: number },
) {
  const sb = await createClient();
  const { error } = await sb.from("council_agenda_items").update(patch).eq("id", id);
  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteAgendaItem(id: string, meetingId: string) {
  const sb = await createClient();
  const { error } = await sb.from("council_agenda_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/councils/${meetingId}`);
  return { error: null };
}

export async function reorderAgendaItems(
  meetingId: string,
  orderedIds: string[],
) {
  const sb = await createClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await sb
      .from("council_agenda_items")
      .update({ position: i + 1 })
      .eq("id", orderedIds[i]);
    if (error) return { error: error.message };
  }
  revalidatePath(`/councils/${meetingId}`);
  return { error: null };
}

/**
 * Copy the previous meeting's agenda items onto `targetId`, appended after
 * anything already there. Used by the "Pull items from last meeting" button
 * in the editor so unresolved business carries forward with one tap.
 */
export async function copyItemsFromLastMeeting(targetId: string) {
  const sb = await createClient();
  const { data: target } = await sb
    .from("council_meetings")
    .select("kind, meeting_date")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) return { error: "Meeting not found.", copied: 0 };
  const { data: prev } = await sb
    .from("council_meetings")
    .select("id")
    .eq("kind", (target as { kind: string }).kind)
    .lt("meeting_date", (target as { meeting_date: string }).meeting_date)
    .order("meeting_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!prev) return { error: "No earlier meeting to copy from.", copied: 0 };
  const { data: items } = await sb
    .from("council_agenda_items")
    .select("title, sub_note, position")
    .eq("meeting_id", (prev as { id: string }).id)
    .order("position");
  if (!items || items.length === 0) {
    return { error: "The last meeting had no items.", copied: 0 };
  }
  const { data: max } = await sb
    .from("council_agenda_items")
    .select("position")
    .eq("meeting_id", targetId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const base = ((max?.position as number | undefined) ?? 0);
  const rows = (items as Array<{ title: string; sub_note: string | null; position: number }>).map(
    (it, i) => ({
      meeting_id: targetId,
      title: it.title,
      sub_note: it.sub_note,
      position: base + i + 1,
    }),
  );
  const { error } = await sb.from("council_agenda_items").insert(rows);
  if (error) return { error: error.message, copied: 0 };
  revalidatePath(`/councils/${targetId}`);
  return { error: null, copied: rows.length };
}
