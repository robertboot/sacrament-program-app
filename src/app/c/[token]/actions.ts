"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";

export async function respondToAssignment(
  token: string,
  response: "confirmed" | "declined",
) {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc("respond_to_assignment", {
    p_token: token,
    p_response: response,
  });
  if (error) return { error: error.message };
  const payload = data as { ok: boolean; error?: string; status?: string };
  if (!payload.ok) return { error: payload.error ?? "Could not record response." };
  revalidatePath(`/c/${token}`);
  revalidatePath("/");
  return { error: null };
}
