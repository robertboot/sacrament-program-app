// Invite a user. Creates an auth account (no password) and emails them a
// one-time magic link they use to set their password. The handle_new_auth_user
// trigger creates a chorister profile; we then update the name (and role, if
// requested).
//
// Usage:
//   node scripts/invite-user.mjs <email> <full name> [role]
//   role: chorister (default) or bishopric/<position>
//
// Examples:
//   node scripts/invite-user.mjs shanna.boot@icloud.com "Shanna Boot"
//   node scripts/invite-user.mjs dean@x.com "Bro. Dean" bishopric/first_counselor

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const [, , emailArg, ...nameParts] = process.argv;
if (!emailArg || nameParts.length === 0) {
  console.error('Usage: node scripts/invite-user.mjs <email> "<full name>" [chorister|bishopric/<position>]');
  process.exit(1);
}

// Last arg might be a role spec (no spaces, contains "/" for bishopric or is "chorister").
let roleArg = "chorister";
let position = null;
const last = nameParts[nameParts.length - 1];
if (last === "chorister" || last.startsWith("bishopric/")) {
  roleArg = last;
  nameParts.pop();
  if (roleArg.startsWith("bishopric/")) {
    position = roleArg.split("/")[1];
    roleArg = "bishopric";
  }
}
const fullName = nameParts.join(" ");
const email = emailArg.trim().toLowerCase();

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const siteUrl =
  env.NEXT_PUBLIC_SITE_URL || "https://sacrament-program-app.vercel.app";

console.log(`Inviting ${fullName} <${email}> as ${roleArg}${position ? `/${position}` : ""}…`);

const { data: invite, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
  email,
  {
    data: { full_name: fullName },
    redirectTo: `${siteUrl}/auth/callback`,
  },
);
if (inviteErr) {
  console.error("Invite failed:", inviteErr.message);
  process.exit(1);
}

const userId = invite.user.id;

// The handle_new_auth_user trigger already created a chorister profile.
// Update the name (and promote to bishopric if requested).
const update =
  roleArg === "bishopric"
    ? { full_name: fullName, role: "bishopric", bishopric_position: position }
    : { full_name: fullName };
const { error: profErr } = await admin.from("profiles").update(update).eq("id", userId);
if (profErr) {
  console.error("Profile update failed:", profErr.message);
  process.exit(1);
}

console.log(`Sent. ${fullName} will receive an email from Supabase with a magic link to set their password and sign in.`);
