import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { NotificationType } from "@/lib/supabase/types";

type NotifyPayload = {
  type: NotificationType;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
};

/**
 * Fan out an event to every leader (bishopric) in the app. In-app rows
 * land in `notifications` — the bell dropdown reads from there.
 *
 * Called from server-side hooks: the Twilio inbound webhook, publish
 * transitions, auto-generate, and the daily cron sweepers.
 *
 * Uses the service client so RLS + no-user-session (webhook) writes
 * still succeed. Notifications are best-effort — a failure here should
 * never take down the underlying action (invite send, publish, etc.).
 *
 * SMS-to-leaders is deliberately out of scope at v1: leaders sign in
 * with email and no phone number is on file for them. Adding SMS to
 * leaders would require a separate phone-collection UI + validation.
 * Speakers still get SMS via the existing sendAssignmentInvite path.
 */
export async function notifyBishopric(payload: NotifyPayload): Promise<void> {
  try {
    const admin = createServiceClient();
    const { data: bishopric } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "bishopric");
    const rows = (bishopric ?? []) as { id: string }[];
    if (rows.length === 0) return;
    await admin.from("notifications").insert(
      rows.map((p) => ({
        user_id: p.id,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? null,
        action_url: payload.actionUrl ?? null,
      })),
    );
  } catch {
    // best-effort
  }
}

/** Fan out to a specific set of recipients (e.g. choristers + counselors
 *  on publish). In-app only. */
export async function notifyUsers(
  userIds: string[],
  payload: NotifyPayload,
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    const admin = createServiceClient();
    await admin.from("notifications").insert(
      userIds.map((id) => ({
        user_id: id,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? null,
        action_url: payload.actionUrl ?? null,
      })),
    );
  } catch {
    // best-effort
  }
}
