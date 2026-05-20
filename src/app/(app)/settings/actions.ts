"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { BishopricPosition, UserRole } from "@/lib/supabase/types";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

async function requireBishopric() {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { error: "Not signed in." as const };
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userRes.user.id)
    .single();
  if (callerProfile?.role !== "bishopric")
    return { error: "Bishopric only." as const };
  return { callerId: userRes.user.id };
}

type SettingsInput = {
  branch_name: string;
  default_welcome_text: string;
  assignment_paper_template: string;
  calendar_ics_url: string | null;
  unit_type: "ward" | "branch";
  ward_business_footer: string;
};

export async function updateSettings(input: SettingsInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").update(input).eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}

export async function updateUserRole(
  userId: string,
  role: UserRole,
  position: BishopricPosition | null,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role, bishopric_position: role === "bishopric" ? position : null })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}

/**
 * Create a member by email. Mints an auth user (email_confirm so they're
 * usable immediately) and promotes the trigger-created profile to the
 * requested role. Returns a magic link the bishop can share so the new
 * user can sign in and set a password.
 *
 * If no email is supplied a placeholder is used — the member won't be
 * able to sign in until the bishop edits them to add a real email.
 */
async function createMember({
  name,
  email,
  role,
  position,
}: {
  name: string;
  email: string | null;
  role: UserRole;
  position: BishopricPosition | null;
}) {
  const finalEmail =
    email?.trim() ||
    `${slugify(name)}-${Date.now().toString(36)}@${role}.placeholder.invalid`;

  const admin = createServiceClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: finalEmail,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (createErr || !created?.user) {
    return { error: createErr?.message ?? "Failed to create user." };
  }

  // The handle_new_auth_user trigger inserted a chorister profile. Update it.
  const { error: roleErr } = await admin
    .from("profiles")
    .update({
      full_name: name,
      role,
      bishopric_position: role === "bishopric" ? position : null,
    })
    .eq("id", created.user.id);
  if (roleErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: roleErr.message };
  }

  // Generate a magic-link the bishop can forward. Only meaningful when
  // there's a real email — placeholder emails won't actually deliver, but
  // the URL itself still signs the user in if pasted.
  let inviteLink: string | null = null;
  if (email?.trim()) {
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://sacrament-program-app.vercel.app";
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: finalEmail,
      options: { redirectTo: `${siteUrl}/auth/callback?next=/home` },
    });
    inviteLink = linkData?.properties?.action_link ?? null;
  }

  revalidatePath("/settings");
  revalidatePath("/");
  return { error: null, id: created.user.id, inviteLink };
}

export async function addBishopricMember({
  name,
  email,
  position,
}: {
  name: string;
  email: string | null;
  position: BishopricPosition;
}) {
  const auth = await requireBishopric();
  if ("error" in auth) return { error: auth.error };
  return createMember({ name, email, role: "bishopric", position });
}

export async function addChoristerMember({
  name,
  email,
}: {
  name: string;
  email: string | null;
}) {
  const auth = await requireBishopric();
  if ("error" in auth) return { error: auth.error };
  return createMember({ name, email, role: "chorister", position: null });
}

/**
 * Update a bishopric member's name, email, and/or position. If the new
 * position is already held by a different member, the two are swapped.
 */
export async function updateBishopricMember(
  userId: string,
  {
    full_name,
    email,
    position,
  }: { full_name: string; email: string | null; position: BishopricPosition },
) {
  const auth = await requireBishopric();
  if ("error" in auth) return { error: auth.error };

  const admin = createServiceClient();

  const { data: target, error: tErr } = await admin
    .from("profiles")
    .select("id, bishopric_position")
    .eq("id", userId)
    .single();
  if (tErr || !target) return { error: tErr?.message ?? "Member not found." };

  // Update email on auth.users if supplied.
  if (email?.trim()) {
    const { error: emailErr } = await admin.auth.admin.updateUserById(userId, {
      email: email.trim(),
      email_confirm: true,
    });
    if (emailErr) return { error: emailErr.message };
  }

  const { data: incumbent } = await admin
    .from("profiles")
    .select("id, bishopric_position")
    .eq("bishopric_position", position)
    .neq("id", userId)
    .maybeSingle();

  if (incumbent) {
    const { error: e1 } = await admin
      .from("profiles")
      .update({ role: "chorister", bishopric_position: null })
      .in("id", [target.id, incumbent.id]);
    if (e1) return { error: e1.message };

    const { error: e2 } = await admin
      .from("profiles")
      .update({ role: "bishopric", full_name, bishopric_position: position })
      .eq("id", target.id);
    if (e2) return { error: e2.message };

    const { error: e3 } = await admin
      .from("profiles")
      .update({ role: "bishopric", bishopric_position: target.bishopric_position })
      .eq("id", incumbent.id);
    if (e3) return { error: e3.message };
  } else {
    const { error } = await admin
      .from("profiles")
      .update({ full_name, bishopric_position: position })
      .eq("id", userId);
    if (error) return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/");
  return { error: null };
}

export async function updateChoristerMember(
  userId: string,
  { full_name, email }: { full_name: string; email: string | null },
) {
  const auth = await requireBishopric();
  if ("error" in auth) return { error: auth.error };
  const admin = createServiceClient();

  if (email?.trim()) {
    const { error: emailErr } = await admin.auth.admin.updateUserById(userId, {
      email: email.trim(),
      email_confirm: true,
    });
    if (emailErr) return { error: emailErr.message };
  }

  const { error } = await admin
    .from("profiles")
    .update({ full_name })
    .eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { error: null };
}

/**
 * Delete a user entirely — revokes their auth access and removes their
 * profile via FK cascade. Used when replacing a bishopric or chorister
 * member so the previous person can no longer sign in.
 */
export async function removeMember(userId: string) {
  const auth = await requireBishopric();
  if ("error" in auth) return { error: auth.error };
  if (userId === auth.callerId) return { error: "You can't remove yourself." };

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}

// Backwards-compat alias for the old function name used elsewhere.
export const removeBishopricMember = removeMember;

/**
 * Generate a fresh magic-link sign-in URL for an existing member so the
 * bishop can re-share it (the previous one may have expired or never
 * been forwarded). The link signs the user in directly; from there they
 * can set a password via the auth page if desired.
 */
export async function inviteMember(userId: string) {
  const auth = await requireBishopric();
  if ("error" in auth) return { error: auth.error };

  const admin = createServiceClient();
  const { data: u, error: uErr } = await admin.auth.admin.getUserById(userId);
  if (uErr || !u?.user?.email) {
    return { error: uErr?.message ?? "No email on file for this user." };
  }
  if (u.user.email.endsWith(".placeholder.invalid")) {
    return {
      error:
        "No real email on file. Edit the member and add their email first.",
    };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://sacrament-program-app.vercel.app";

  // Preferred path: have Supabase email the magic link directly.
  const supabase = await createClient();
  const { error: otpErr } = await supabase.auth.signInWithOtp({
    email: u.user.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${siteUrl}/auth/callback?next=/home`,
    },
  });
  if (!otpErr) {
    return { error: null, sent: true, email: u.user.email };
  }

  // Fallback: produce a link the bishop can copy/paste if email sending
  // is rate-limited or SMTP isn't configured in Supabase.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: u.user.email,
    options: { redirectTo: `${siteUrl}/auth/callback?next=/home` },
  });
  if (linkErr) return { error: linkErr.message ?? otpErr.message };
  return {
    error: null,
    sent: false,
    inviteLink: linkData?.properties?.action_link ?? null,
    sendError: otpErr.message,
  };
}

/**
 * Update a hymn's usage tags + verse note. Bishopric-only. Used by the
 * Settings hymn-tag editor to flag funeral/baptism/holiday hymns and
 * record verse-restriction notes that can print on the program.
 */
export async function updateHymnMeta(
  hymnId: number,
  { usage_tags, verse_note }: { usage_tags: string[]; verse_note: string | null },
) {
  const auth = await requireBishopric();
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("hymns")
    .update({ usage_tags, verse_note: verse_note?.trim() || null })
    .eq("id", hymnId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/");
  return { error: null };
}
