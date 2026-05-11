"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Extend the schedule by one calendar month past the latest existing program.
 * The bishop calls this once a month (manually via the dashboard button or
 * automatically via cron on the 1st) to maintain the rolling 3-month window.
 */
export async function ensureNextMonthPrograms() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_next_month_programs");
  if (error) return { error: error.message, created: 0 };
  revalidatePath("/");
  return { created: (data as number) ?? 0, error: null };
}

export async function recomputeRotationDates() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("recompute_all_rotation_dates");
  if (error) return { error: error.message };
  revalidatePath("/");
  return { error: null };
}
