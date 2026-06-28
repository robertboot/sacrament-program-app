"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

type InvitePreview = {
  token: string;
  unit_id: string;
  unit_name: string;
  role: "leader" | "chorister";
  position: string | null;
  email: string;
  inviter_name: string | null;
  expires_at: string;
};

/**
 * Read-only invite lookup used by the /accept-invite page to render the
 * "Join {unit} as {role}" confirmation. Uses the service client because the
 * signed-in user is not yet a unit_member and so RLS won't show them either
 * the invite or the unit.
 *
 * Returns { error } when the token is missing, expired, or already accepted.
 */
export async function loadInvite(token: string): Promise<
  { invite: InvitePreview; error: null } | { invite: null; error: string }
> {
  if (!token) return { invite: null, error: "Missing invite token." };

  const admin = createServiceClient();

  const { data, error } = await admin
    .from("unit_invites")
    .select(
      "token, unit_id, email, role, position, accepted_at, expires_at, units(name), inviter:invited_by(full_name)",
    )
    .eq("token", token)
    .maybeSingle();
  if (error) return { invite: null, error: error.message };
  if (!data) return { invite: null, error: "Invite not found." };
  if (data.accepted_at) {
    return { invite: null, error: "This invite has already been accepted." };
  }
  if (new Date(data.expires_at) < new Date()) {
    return { invite: null, error: "This invite has expired." };
  }

  const unit = Array.isArray(data.units) ? data.units[0] : data.units;
  const inviter = Array.isArray(data.inviter) ? data.inviter[0] : data.inviter;
  return {
    invite: {
      token: data.token as string,
      unit_id: data.unit_id as string,
      unit_name: (unit?.name as string) ?? "(unknown unit)",
      role: data.role as "leader" | "chorister",
      position: (data.position as string | null) ?? null,
      email: data.email as string,
      inviter_name: (inviter?.full_name as string) ?? null,
      expires_at: data.expires_at as string,
    },
    error: null,
  };
}

/**
 * Accept an invite. Requires the signed-in user's email to match the invite
 * email (case-insensitive). Enforces the one-active-membership-per-user rule
 * — if the user already belongs to a different unit they must release first.
 *
 * On success:
 *   - inserts unit_members(unit_id, user_id, role, position)
 *   - sets profiles.active_unit_id = invite.unit_id
 *   - marks unit_invites.accepted_at = now()
 */
export async function redeemInvite(token: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first to accept this invite." };

  const admin = createServiceClient();

  const { data: invite, error: iErr } = await admin
    .from("unit_invites")
    .select("token, unit_id, email, role, position, accepted_at, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (iErr) return { error: iErr.message };
  if (!invite) return { error: "Invite not found." };
  if (invite.accepted_at) return { error: "This invite has already been accepted." };
  if (new Date(invite.expires_at) < new Date()) {
    return { error: "This invite has expired." };
  }

  const callerEmail = user.email?.trim().toLowerCase() ?? "";
  if (callerEmail !== (invite.email as string).trim().toLowerCase()) {
    return {
      error: `This invite is for ${invite.email}. You are signed in as ${user.email}. Sign in as the invited email to continue.`,
    };
  }

  // One-active-membership rule: if user is in any unit other than this one,
  // block until they release. (Membership in the SAME unit is treated as a
  // no-op success — they probably hit the link twice.)
  const { data: existing } = await admin
    .from("unit_members")
    .select("unit_id")
    .eq("user_id", user.id);
  const memberships = (existing ?? []) as { unit_id: string }[];
  const inThisUnit = memberships.some((m) => m.unit_id === invite.unit_id);
  const inOtherUnit = memberships.some((m) => m.unit_id !== invite.unit_id);
  if (inOtherUnit) {
    return {
      error:
        "You're already a member of another unit. Ask a leader there to release you, then accept this invite.",
    };
  }

  if (!inThisUnit) {
    // Position must still be free.
    if (invite.position) {
      const { data: holder } = await admin
        .from("unit_members")
        .select("user_id")
        .eq("unit_id", invite.unit_id)
        .eq("position", invite.position)
        .maybeSingle();
      if (holder) {
        return {
          error:
            "That leadership position has been filled since the invite was sent. Ask the unit leader to send a fresh invite.",
        };
      }
    }
    const { error: insErr } = await admin.from("unit_members").insert({
      unit_id: invite.unit_id,
      user_id: user.id,
      role: invite.role,
      position: invite.position,
    });
    if (insErr) return { error: insErr.message };
  }

  // Set this as the user's active unit so the next page render uses it.
  await admin
    .from("profiles")
    .update({ active_unit_id: invite.unit_id })
    .eq("id", user.id);

  await admin
    .from("unit_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("token", token);

  revalidatePath("/", "layout");
  return { error: null };
}
