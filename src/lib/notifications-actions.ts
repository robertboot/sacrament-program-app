"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/supabase/types";

// getClaims() reads + verifies the JWT locally (no network round-trip);
// getUser() would hit Supabase's auth server on every 60s bell poll. We
// still filter by user_id at the app layer because the notifications
// table currently doesn't have RLS policies enabled.

async function claimedUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

/**
 * Cheap poll for the header bell: just the unread count. Called every
 * minute; the full row list is only fetched when the dropdown opens.
 * Uses head:true so no rows are shipped over the wire.
 */
export async function countUnreadNotifications(): Promise<number> {
  const { supabase, userId } = await claimedUserId();
  if (!userId) return 0;
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

export async function listNotifications(): Promise<Notification[]> {
  const { supabase, userId } = await claimedUserId();
  if (!userId) return [];
  // Defensive: notifications table may not exist yet on databases where the
  // migration hasn't been applied. Swallow the error and return [] so the
  // header doesn't crash.
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return [];
  return (data ?? []) as Notification[];
}

export async function markNotificationRead(id: string) {
  const { supabase, userId } = await claimedUserId();
  if (!userId) return { error: "Not signed in." };
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { error: null };
}

export async function markAllNotificationsRead() {
  const { supabase, userId } = await claimedUserId();
  if (!userId) return { error: "Not signed in." };
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { error: null };
}
