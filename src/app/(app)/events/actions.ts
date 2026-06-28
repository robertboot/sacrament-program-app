"use server";

import { revalidatePath } from "next/cache";
import { addDays, format, parseISO, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { loadActiveUnit } from "@/lib/active-unit";
import { parseIcal } from "@/lib/ical";

type EventInput = {
  title: string;
  description?: string | null;
  event_date?: string | null;
  display_start: string;
  display_end: string;
  as_brief_reminder?: boolean;
};

/** First-time setup: persist the Church-supplied iCal feed URL so the
 *  Events page can sync without sending the bishop over to /settings. */
export async function saveCalendarUrl(url: string) {
  const supabase = await createClient();
  const trimmed = url.trim() || null;
  const { error } = await supabase
    .from("app_settings")
    .update({ calendar_ics_url: trimmed })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/events");
  revalidatePath("/settings");
  return { error: null };
}

export async function createEvent(input: EventInput) {
  const ctx = await loadActiveUnit();
  if (!ctx) return { error: "No active unit." };
  if (ctx.role !== "leader") return { error: "Leaders only." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .insert({ ...input, unit_id: ctx.unit.id });
  if (error) return { error: error.message };
  revalidatePath("/events");
  return { error: null };
}

export async function updateEvent(id: string, input: EventInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("events").update(input).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/events");
  return { error: null };
}

export async function deleteEvent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/events");
  return { error: null };
}

export async function toggleBriefReminder(id: string, value: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ as_brief_reminder: value })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/events");
  revalidatePath("/");
  return { error: null };
}

/**
 * Pull events from the iCal URL stored in app_settings. Idempotent: new events
 * insert (with a 4-week display window ending on the event date), existing
 * synced events get their title/description/date refreshed but keep the user's
 * display window. Existing user-created events (no external_uid) are untouched.
 */
export async function syncCalendar() {
  const ctx = await loadActiveUnit();
  if (!ctx) return { error: "No active unit.", inserted: 0, updated: 0 };
  if (ctx.role !== "leader") return { error: "Leaders only.", inserted: 0, updated: 0 };
  const supabase = await createClient();

  const url = ctx.unit.calendar_ics_url?.trim();
  if (!url) return { error: "No calendar URL set in Settings.", inserted: 0, updated: 0 };

  let text: string;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { error: `Fetch failed: ${res.status}`, inserted: 0, updated: 0 };
    text = await res.text();
  } catch (e) {
    return { error: `Fetch error: ${(e as Error).message}`, inserted: 0, updated: 0 };
  }

  const parsed = parseIcal(text);
  if (parsed.length === 0) return { error: "No events found in feed.", inserted: 0, updated: 0 };

  // Dedupe within the feed (same UID with multiple instances — keep the latest).
  const byUid = new Map<string, (typeof parsed)[number]>();
  for (const e of parsed) byUid.set(e.uid, e);

  // Which UIDs already exist?
  const uids = [...byUid.keys()];
  const { data: existing } = await supabase
    .from("events")
    .select("external_uid")
    .eq("unit_id", ctx.unit.id)
    .in("external_uid", uids);
  const existingUids = new Set((existing ?? []).map((r) => r.external_uid));

  const toInsert: Array<Record<string, unknown>> = [];
  const toUpdate: Array<(typeof parsed)[number]> = [];
  for (const ev of byUid.values()) {
    if (existingUids.has(ev.uid)) {
      toUpdate.push(ev);
    } else {
      const eventDate = parseISO(ev.date);
      toInsert.push({
        unit_id: ctx.unit.id,
        external_uid: ev.uid,
        title: ev.summary,
        description: ev.description,
        event_date: ev.date,
        display_start: format(subDays(eventDate, 28), "yyyy-MM-dd"),
        display_end: format(addDays(eventDate, 1), "yyyy-MM-dd"),
      });
    }
  }

  let inserted = 0;
  if (toInsert.length) {
    const { error, count } = await supabase
      .from("events")
      .insert(toInsert, { count: "exact" });
    if (error) return { error: `Insert: ${error.message}`, inserted: 0, updated: 0 };
    inserted = count ?? toInsert.length;
  }

  let updated = 0;
  for (const ev of toUpdate) {
    const { error } = await supabase
      .from("events")
      .update({
        title: ev.summary,
        description: ev.description,
        event_date: ev.date,
      })
      .eq("unit_id", ctx.unit.id)
      .eq("external_uid", ev.uid);
    if (error) continue;
    updated++;
  }

  revalidatePath("/events");
  revalidatePath("/");
  return { error: null, inserted, updated };
}
