"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { loadActiveUnit } from "@/lib/active-unit";
import type { LeaderPosition, MemberRole } from "@/lib/supabase/types";

/**
 * Multi-tenant invite create. Leader-only.
 *
 * Inserts a row in `unit_invites` for the active unit and emails a sign-in
 * magic link to the invitee. The link lands on /auth/callback, which signs
 * the recipient in and redirects to /accept-invite?invite={token}; the
 * accept-invite page resolves the invite into a unit_members row via
 * `redeemInvite`.
 *
 * Behavior:
 *  - If the email is already a member of this unit → no-op success.
 *  - If a pending invite for this email already exists → token + expiry are
 *    rotated (the dialog can re-send).
 *  - If the email matches an already-existing auth user, the magic link
 *    just signs them in (shouldCreateUser=true ensures new emails work too).
 *
 * Returns the invite token + the email so the caller can render a fallback
 * "copy link" affordance like the legacy flow.
 */
export async function createInvite({
  email,
  role,
  position,
}: {
  email: string;
  role: MemberRole;
  position: LeaderPosition | null;
}) {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Email is required." };
  if (role === "leader" && !position) {
    return { error: "Leader invites need a position." };
  }
  if (role === "chorister" && position) {
    return { error: "Chorister invites can't have a leader position." };
  }

  const ctx = await loadActiveUnit();
  if (!ctx) return { error: "Not signed in or no active unit." };
  if (ctx.role !== "leader") return { error: "Leaders only." };

  const admin = createServiceClient();

  // Already a member?
  const { data: existingMember } = await admin
    .from("unit_members")
    .select("user_id, profiles!inner(email)")
    .eq("unit_id", ctx.unit.id)
    .eq("profiles.email", trimmed)
    .maybeSingle();
  if (existingMember) {
    return { error: "That email is already a member of this unit." };
  }

  // Position already filled?
  if (position) {
    const { data: positionHolder } = await admin
      .from("unit_members")
      .select("user_id")
      .eq("unit_id", ctx.unit.id)
      .eq("position", position)
      .maybeSingle();
    if (positionHolder) {
      return {
        error:
          "That position is already filled. Release the current member first.",
      };
    }
  }

  // Upsert the invite — if one already exists for (unit, email), rotate it.
  const { data: invite, error: upsertErr } = await admin
    .from("unit_invites")
    .upsert(
      {
        unit_id: ctx.unit.id,
        email: trimmed,
        role,
        position,
        invited_by: ctx.userId,
        accepted_at: null,
        // Re-issue a fresh token + 7-day expiry.
        token: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "unit_id,email" },
    )
    .select("token")
    .single();
  if (upsertErr || !invite) {
    return { error: upsertErr?.message ?? "Failed to create invite." };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://sacrament-program-app.vercel.app";
  const acceptPath = `/accept-invite?invite=${invite.token}`;

  // Send a magic link the recipient can click to sign in. shouldCreateUser
  // means brand-new emails get an auth row minted on their first click.
  const supabase = await createClient();
  const { error: otpErr } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(acceptPath)}`,
    },
  });
  if (otpErr) {
    return { error: otpErr.message };
  }

  // Also generate a paste-able magic link as a fallback (covers cases where
  // the email never lands and the leader wants to forward via text).
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: trimmed,
    options: { redirectTo: `${siteUrl}/auth/callback?next=${acceptPath}` },
  });

  revalidatePath("/settings");
  return {
    error: null,
    email: trimmed,
    token: invite.token as string,
    inviteLink: linkData?.properties?.action_link ?? `${siteUrl}${acceptPath}`,
  };
}

/**
 * Revoke a still-pending invite. Leader-only.
 */
export async function revokeInvite(token: string) {
  const ctx = await loadActiveUnit();
  if (!ctx) return { error: "Not signed in or no active unit." };
  if (ctx.role !== "leader") return { error: "Leaders only." };

  const admin = createServiceClient();
  const { error } = await admin
    .from("unit_invites")
    .delete()
    .eq("token", token)
    .eq("unit_id", ctx.unit.id)
    .is("accepted_at", null);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}
