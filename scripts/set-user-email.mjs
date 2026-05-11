// For an existing profile, replace the auth user's placeholder email with a
// real one and email them a password-setup ("recovery") link so they can sign
// in. Preserves bishopric_position and any other profile data.
//
// Usage:
//   node scripts/set-user-email.mjs "<profile full_name>" <new email>

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const [, , nameArg, emailArg] = process.argv;
if (!nameArg || !emailArg) {
  console.error('Usage: node scripts/set-user-email.mjs "<full_name>" <email>');
  process.exit(1);
}
const fullName = nameArg.trim();
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

const { data: prof, error: pe } = await admin
  .from("profiles")
  .select("id, full_name, role, bishopric_position")
  .eq("full_name", fullName)
  .single();
if (pe || !prof) {
  console.error(`No profile found with full_name "${fullName}".`);
  process.exit(1);
}

console.log(
  `Updating ${prof.full_name} (${prof.role}${prof.bishopric_position ? `/${prof.bishopric_position}` : ""}) → ${email}`,
);

const { error: ue } = await admin.auth.admin.updateUserById(prof.id, {
  email,
  email_confirm: true,
});
if (ue) {
  console.error("Email update failed:", ue.message);
  process.exit(1);
}

const siteUrl =
  env.NEXT_PUBLIC_SITE_URL || "https://sacrament-program-app.vercel.app";

// Generate a recovery link. With Supabase's default SMTP and an enabled
// recovery template, this also sends the email; otherwise the action_link
// returned here can be sent manually.
const { data: link, error: le } = await admin.auth.admin.generateLink({
  type: "recovery",
  email,
  options: { redirectTo: `${siteUrl}/auth/callback` },
});
if (le) {
  console.error("Link generation failed:", le.message);
  process.exit(1);
}

console.log(
  `Sent recovery email to ${email}. If they don't see it, the one-time link is:\n  ${link.properties?.action_link}`,
);
