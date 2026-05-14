"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SpeakerCategory } from "@/lib/supabase/types";

type SpeakerInput = {
  full_name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  is_active: boolean;
  categories: SpeakerCategory[];
  /**
   * Manual override for backfilling speakers who spoke before the system was
   * set up. Once a confirmed assignment exists with a later meeting_date, the
   * `recompute_speaker_last_spoke` trigger will overwrite this with that
   * assignment's date.
   */
  last_spoke_date?: string | null;
};

export async function createSpeaker(input: SpeakerInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("speakers")
    .insert({
      full_name: input.full_name,
      phone: input.phone,
      email: input.email,
      notes: input.notes,
      is_active: input.is_active,
      last_spoke_date: input.last_spoke_date ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  if (input.categories.length) {
    const { error: catErr } = await supabase
      .from("speaker_categories")
      .insert(input.categories.map((c) => ({ speaker_id: data!.id, category: c })));
    if (catErr) return { error: catErr.message };
  }
  revalidatePath("/speakers");
  return { error: null };
}

export async function updateSpeaker(id: string, input: SpeakerInput) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("speakers")
    .update({
      full_name: input.full_name,
      phone: input.phone,
      email: input.email,
      notes: input.notes,
      is_active: input.is_active,
      last_spoke_date: input.last_spoke_date ?? null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("speaker_categories").delete().eq("speaker_id", id);
  if (input.categories.length) {
    const { error: catErr } = await supabase
      .from("speaker_categories")
      .insert(input.categories.map((c) => ({ speaker_id: id, category: c })));
    if (catErr) return { error: catErr.message };
  }
  revalidatePath("/speakers");
  return { error: null };
}

export type SpeakerHistoryEntry = {
  date: string; // ISO YYYY-MM-DD
  kind: "upcoming" | "past";
};

/**
 * Fetch a single speaker by id with categories hydrated. Used by the planner
 * person-avatar to open the same detail dialog as the Speakers page without
 * carrying the entire speakers table in the dashboard payload.
 */
export async function getSpeakerById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("speakers")
    .select("*, speaker_categories(category)")
    .eq("id", id)
    .single();
  if (error || !data) return { speaker: null as null };
  const speaker = {
    ...data,
    categories: (data.speaker_categories ?? []).map(
      (c: { category: SpeakerCategory }) => c.category,
    ),
  };
  return { speaker };
}

/**
 * Returns every speaking date for this speaker, tagged as `past` (confirmed
 * past assignments + manual historical_dates) or `upcoming` (any future
 * assignment that isn't declined). Newest first across both buckets so the
 * upcoming dates appear at the top of the list.
 */
export async function getSpeakerHistory(speakerId: string) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [assignmentsRes, speakerRes] = await Promise.all([
    supabase
      .from("speaking_assignments")
      .select(`status, program:programs!inner(meeting_date)`)
      .eq("speaker_id", speakerId)
      .neq("status", "declined"),
    // historical_dates may not exist yet on older databases — request it,
    // fall back to an empty array if the column is missing.
    supabase
      .from("speakers")
      .select("historical_dates")
      .eq("id", speakerId)
      .maybeSingle(),
  ]);
  if (assignmentsRes.error)
    return { error: assignmentsRes.error.message, entries: [] as SpeakerHistoryEntry[] };

  type Row = {
    status: string;
    program: { meeting_date: string } | { meeting_date: string }[] | null;
  };

  const upcomingDates = new Set<string>();
  const pastDates = new Set<string>();
  for (const r of (assignmentsRes.data ?? []) as Row[]) {
    const p = Array.isArray(r.program) ? r.program[0] : r.program;
    if (!p?.meeting_date) continue;
    if (p.meeting_date >= today) {
      upcomingDates.add(p.meeting_date);
    } else if (r.status === "confirmed") {
      pastDates.add(p.meeting_date);
    }
  }

  const historical =
    (speakerRes.data as { historical_dates?: string[] } | null)?.historical_dates ?? [];
  for (const d of historical) {
    // Historical entries are by definition past — but skip if it sneaks in as today/future.
    if (d < today) pastDates.add(d);
  }

  const entries: SpeakerHistoryEntry[] = [
    ...[...upcomingDates].map((d) => ({ date: d, kind: "upcoming" as const })),
    ...[...pastDates].map((d) => ({ date: d, kind: "past" as const })),
  ].sort((a, b) => b.date.localeCompare(a.date)); // newest first

  return { error: null, entries };
}

/**
 * Hard-delete a speaker. The speaker_id on any past speaking_assignments
 * cascades to NULL (per the FK definition), so they'll show as "—" on those
 * historical programs. Use this only when a speaker was added in error — to
 * temporarily exclude someone from rotation, uncheck the Active checkbox
 * instead so their history is preserved.
 */
export async function deleteSpeaker(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("speakers").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/speakers");
  revalidatePath("/");
  return { error: null };
}

/**
 * Bulk import: rows of "Name, category1|category2" (categories optional).
 * Categories accept "first"/"5", "second"/"10", "concluding"/"15".
 * The defaults passed in apply to rows that don't specify inline categories.
 * isActive is applied to all imported speakers.
 */
export async function bulkImportSpeakers(
  rawText: string,
  defaultCategories: SpeakerCategory[],
  isActive: boolean,
) {
  const supabase = await createClient();
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let inserted = 0;
  for (const line of lines) {
    const [namePart, catPart] = line.split(",", 2).map((s) => s?.trim() ?? "");
    if (!namePart) continue;
    const inlineCats = (catPart || "")
      .split("|")
      .map((s) => s.trim().toLowerCase())
      .map((c) => {
        if (c === "first" || c === "5" || c === "5min" || c === "5 min") return "first";
        if (c === "second" || c === "10" || c === "10min" || c === "10 min") return "second";
        if (c === "concluding" || c === "15" || c === "15min" || c === "15 min") return "concluding";
        return null;
      })
      .filter((c): c is SpeakerCategory => c !== null);
    const cats = inlineCats.length > 0 ? inlineCats : defaultCategories;

    const { data, error } = await supabase
      .from("speakers")
      .insert({ full_name: namePart, is_active: isActive })
      .select("id")
      .single();
    if (error) continue;
    if (cats.length) {
      await supabase
        .from("speaker_categories")
        .insert(cats.map((c) => ({ speaker_id: data!.id, category: c })));
    }
    inserted++;
  }
  revalidatePath("/speakers");
  return { inserted };
}
