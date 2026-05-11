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
  // Clear position if not bishopric.
  const { error } = await supabase
    .from("profiles")
    .update({ role, bishopric_position: role === "bishopric" ? position : null })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}

/**
 * Create a bishopric member without requiring them to sign up.
 * Bishop fills in name + position; we mint an auth user with a placeholder
 * email (so they can later claim it via password reset / magic link if they
 * want to sign in) and stamp the profile as bishopric.
 *
 * If `email` is provided, the user can be invited to sign in normally.
 */
export async function addBishopricMember({
  name,
  email,
  position,
}: {
  name: string;
  email: string | null;
  position: BishopricPosition;
}) {
  // Verify caller is bishopric.
  const userSupabase = await createClient();
  const { data: userRes } = await userSupabase.auth.getUser();
  if (!userRes.user) return { error: "Not signed in." };
  const { data: callerProfile } = await userSupabase
    .from("profiles")
    .select("role")
    .eq("id", userRes.user.id)
    .single();
  if (callerProfile?.role !== "bishopric") return { error: "Bishopric only." };

  const finalEmail =
    email?.trim() || `${slugify(name)}-${Date.now().toString(36)}@bishopric.placeholder.invalid`;

  const admin = createServiceClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: finalEmail,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (createErr || !created?.user) {
    return { error: createErr?.message ?? "Failed to create user." };
  }

  // The handle_new_auth_user trigger already inserted a chorister profile.
  // Promote it. If the position slot is taken, this fails on the unique index.
  const { error: roleErr } = await admin
    .from("profiles")
    .update({ full_name: name, role: "bishopric", bishopric_position: position })
    .eq("id", created.user.id);
  if (roleErr) {
    // Roll back the auth user so we don't leave an orphan.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: roleErr.message };
  }

  revalidatePath("/settings");
  revalidatePath("/");
  return { error: null, id: created.user.id };
}

/**
 * Edit a bishopric member's name and/or position.
 * If the new position is already held by a different member, the two are swapped.
 */
export async function updateBishopricMember(
  userId: string,
  { full_name, position }: { full_name: string; position: BishopricPosition },
) {
  const userSupabase = await createClient();
  const { data: userRes } = await userSupabase.auth.getUser();
  const { data: callerProfile } = await userSupabase
    .from("profiles")
    .select("role")
    .eq("id", userRes.user!.id)
    .single();
  if (callerProfile?.role !== "bishopric") return { error: "Bishopric only." };

  const admin = createServiceClient();

  // Current state of the target.
  const { data: target, error: tErr } = await admin
    .from("profiles")
    .select("id, bishopric_position")
    .eq("id", userId)
    .single();
  if (tErr || !target) return { error: tErr?.message ?? "Member not found." };

  // Who currently holds the new position (if anyone, and not the same person)?
  const { data: incumbent } = await admin
    .from("profiles")
    .select("id, bishopric_position")
    .eq("bishopric_position", position)
    .neq("id", userId)
    .maybeSingle();

  if (incumbent) {
    // Swap: the profiles check constraint requires (role=bishopric AND position
    // not null) OR (role=chorister AND position null), so we briefly demote
    // both to chorister to clear the unique-position index, then restore.
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

export async function removeBishopricMember(userId: string) {
  const userSupabase = await createClient();
  const { data: userRes } = await userSupabase.auth.getUser();
  const { data: callerProfile } = await userSupabase
    .from("profiles")
    .select("role")
    .eq("id", userRes.user!.id)
    .single();
  if (callerProfile?.role !== "bishopric") return { error: "Bishopric only." };
  if (userId === userRes.user!.id) return { error: "You can't remove yourself." };

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}
