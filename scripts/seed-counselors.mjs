// One-time: create the 1st and 2nd Counselor bishopric profiles, then update
// every program whose brief_reminders mentions "Conducted by Hardin/Dean" to
// point conducting_id at the right profile and strip the now-redundant note.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}

const COUNSELORS = [
  { name: "Hardin", position: "first_counselor", hintKey: "Hardin" },
  { name: "Dean", position: "second_counselor", hintKey: "Dean" },
];

async function ensureMember(name, position) {
  // Check if a profile already has this position.
  const { data: existing } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("bishopric_position", position)
    .maybeSingle();
  if (existing) {
    console.log(`  ${position}: already filled by ${existing.full_name} (${existing.id})`);
    return existing.id;
  }

  const email = `${slugify(name)}-${Date.now().toString(36)}@bishopric.placeholder.invalid`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (createErr) throw new Error(`Create ${name}: ${createErr.message}`);

  const { error: roleErr } = await admin
    .from("profiles")
    .update({ full_name: name, role: "bishopric", bishopric_position: position })
    .eq("id", created.user.id);
  if (roleErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw new Error(`Promote ${name}: ${roleErr.message}`);
  }
  console.log(`  ${position}: ${name} (${created.user.id})`);
  return created.user.id;
}

async function main() {
  console.log("Ensuring counselors:");
  const idByHint = new Map();
  for (const c of COUNSELORS) {
    const id = await ensureMember(c.name, c.position);
    idByHint.set(c.hintKey, id);
  }

  // Update programs whose brief_reminders mentions "Conducted by Hardin/Dean".
  const { data: programs } = await admin
    .from("programs")
    .select("id, meeting_date, brief_reminders, conducting_id");

  let updated = 0;
  for (const p of programs) {
    const note = p.brief_reminders || "";
    let conductingId = p.conducting_id;
    let newNote = note;
    for (const [hint, id] of idByHint) {
      const re = new RegExp(`\\s*[·•]?\\s*Conducted by ${hint}\\s*[·•]?\\s*`, "gi");
      if (re.test(newNote)) {
        conductingId = id;
        newNote = newNote.replace(re, " ").trim();
        // Clean up dangling separators.
        newNote = newNote.replace(/\s*[·•]\s*$/g, "").replace(/^\s*[·•]\s*/g, "").trim();
      }
    }
    if (conductingId === p.conducting_id && newNote === note) continue;
    const { error } = await admin
      .from("programs")
      .update({ conducting_id: conductingId, brief_reminders: newNote || null })
      .eq("id", p.id);
    if (error) {
      console.error(`  ${p.meeting_date}: ${error.message}`);
      continue;
    }
    updated++;
  }
  console.log(`Updated conducting_id on ${updated} programs.`);

  const { error } = await admin.rpc("recompute_all_rotation_dates");
  if (error) console.log(`Recompute warning: ${error.message}`);
  else console.log("Rotation dates refreshed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
