"use server";

import { revalidatePath } from "next/cache";
import { addDays, format, nextSunday, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";

export async function recomputeRotationDates() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("recompute_all_rotation_dates");
  if (error) return { error: error.message };
  revalidatePath("/");
  return { error: null };
}

/**
 * Create the next un-started Sunday program and return its id so the caller
 * can jump straight into the editor. Replaces the old auto-generate /
 * rolling-3-month behavior — the bishop now plans one Sunday at a time.
 *
 * The next date is the Sunday after the latest existing program. If no
 * programs exist yet, it's the upcoming Sunday (today if today is Sunday).
 * Blank program + the three speaker slots are created.
 */
export async function planNextSunday() {
  const supabase = await createClient();

  const { data: latest } = await supabase
    .from("programs")
    .select("meeting_date")
    .order("meeting_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextDate: Date;
  if (latest?.meeting_date) {
    nextDate = addDays(parseISO(latest.meeting_date), 7);
  } else {
    const today = new Date();
    nextDate = today.getDay() === 0 ? today : nextSunday(today);
  }

  // Walk forward a week at a time if that exact date somehow already exists
  // (meeting_date is unique). Bounded so a bad state can't loop forever.
  let dateStr = format(nextDate, "yyyy-MM-dd");
  for (let i = 0; i < 520; i++) {
    const { data: exists } = await supabase
      .from("programs")
      .select("id")
      .eq("meeting_date", dateStr)
      .maybeSingle();
    if (!exists) break;
    nextDate = addDays(nextDate, 7);
    dateStr = format(nextDate, "yyyy-MM-dd");
  }

  const { data: created, error } = await supabase
    .from("programs")
    .insert({ meeting_date: dateStr })
    .select("id")
    .single();
  if (error || !created) {
    return { error: error?.message ?? "Couldn't create the program." };
  }

  const { error: slotErr } = await supabase.from("speaking_assignments").insert([
    { program_id: created.id, slot: "first", length_minutes: 5 },
    { program_id: created.id, slot: "second", length_minutes: 10 },
    { program_id: created.id, slot: "concluding", length_minutes: 15 },
  ]);
  if (slotErr) return { error: slotErr.message };

  revalidatePath("/");
  return { error: null, id: created.id, meetingDate: dateStr };
}

/**
 * Bishopric-only "Advance to next Sunday" — after sacrament meeting on
 * Sunday afternoon, set app_settings.today_override to tomorrow so the
 * Planner / Home stop treating today's meeting as "upcoming" and start
 * showing next Sunday instead. Shared across all leaders (single row
 * in app_settings). Auto-expires: once the real date catches up, the
 * override becomes a no-op via max(current_date, today_override) in
 * the read paths.
 */
export async function advancePlannerToTomorrow() {
  const supabase = await createClient();
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const { error } = await supabase
    .from("app_settings")
    .update({ today_override: tomorrow })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/home");
  return { error: null };
}
