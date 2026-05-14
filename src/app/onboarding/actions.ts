"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LeaderPosition, UnitType } from "@/lib/supabase/types";

export async function createUnit(input: {
  full_name: string;
  unit_name: string;
  unit_type: UnitType;
  position: LeaderPosition;
}) {
  if (!input.full_name) return { error: "Your name is required." };
  if (!input.unit_name) return { error: "Unit name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_unit", {
    p_name: input.unit_name,
    p_type: input.unit_type,
    p_full_name: input.full_name,
    p_position: input.position,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null, unit_id: data as string };
}
