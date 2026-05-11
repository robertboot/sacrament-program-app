import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

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

const { data: profiles, error } = await admin
  .from("profiles")
  .select("id, full_name, role, bishopric_position");
if (error) throw error;

const { data: users, error: ue } = await admin.auth.admin.listUsers();
if (ue) throw ue;

const byId = new Map(users.users.map((u) => [u.id, u]));

console.log("\nProfiles + linked auth users:\n");
for (const p of profiles) {
  const u = byId.get(p.id);
  const email = u?.email ?? "(no auth user)";
  const isPlaceholder = email.includes("placeholder.invalid");
  const lastSignIn = u?.last_sign_in_at ?? "never";
  console.log(
    `  ${p.full_name.padEnd(28)} | ${p.role}${p.bishopric_position ? `/${p.bishopric_position}` : ""} | ${isPlaceholder ? "[placeholder]" : email} | last sign-in: ${lastSignIn}`,
  );
}
