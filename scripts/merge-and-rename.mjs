// User-confirmed merges + renames. Merges combine two records into one
// (repointing speaking_assignments + history). Renames just update full_name.

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

// Pairs to merge: [duplicate_to_drop, canonical_to_keep]
const MERGES = [
  ["Brother Mitchell", "Bro. Mark Mitchell"],
  ["Elder Copeland", "Little Phil Copeland"],
];

// Renames: { fromName: toName }
const RENAMES = {
  "Sis Mitchell": "Sandy Mitchell",
  "Sis Wood": "Freda Wood",
  "Sis Poe": "Mona Poe",
  "Christensen, A.": "Amanda Christensen",
  "Sis Teel": "Rebekah Teel",
};

async function mergePair(dropName, keepName) {
  const { data: rows } = await admin
    .from("speakers")
    .select("id, full_name, last_spoke_date")
    .in("full_name", [dropName, keepName]);
  const drop = rows.find((r) => r.full_name === dropName);
  const keep = rows.find((r) => r.full_name === keepName);
  if (!drop || !keep) {
    console.log(`  ✗ ${dropName} → ${keepName}: one record missing`);
    return;
  }

  const newDate =
    [drop.last_spoke_date, keep.last_spoke_date]
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? null;

  const { error: e1 } = await admin
    .from("speaking_assignments")
    .update({ speaker_id: keep.id })
    .eq("speaker_id", drop.id);
  if (e1) {
    console.log(`  ✗ ${dropName} repoint assignments: ${e1.message}`);
    return;
  }
  const { error: e1b } = await admin
    .from("speaking_assignment_history")
    .update({ speaker_id: keep.id })
    .eq("speaker_id", drop.id);
  if (e1b) {
    console.log(`  ✗ ${dropName} repoint history: ${e1b.message}`);
    return;
  }

  const { data: dropCats } = await admin
    .from("speaker_categories")
    .select("category")
    .eq("speaker_id", drop.id);
  if (dropCats && dropCats.length) {
    await admin.from("speaker_categories").upsert(
      dropCats.map((c) => ({ speaker_id: keep.id, category: c.category })),
      { onConflict: "speaker_id,category" },
    );
  }

  await admin
    .from("speakers")
    .update({ last_spoke_date: newDate })
    .eq("id", keep.id);

  const { error: e2 } = await admin.from("speakers").delete().eq("id", drop.id);
  if (e2) console.log(`  ✗ ${dropName} delete: ${e2.message}`);
  else
    console.log(
      `  ✓ Merged "${dropName}" → "${keepName}" (last spoke ${newDate ?? "unknown"})`,
    );
}

async function rename(fromName, toName) {
  const { error } = await admin
    .from("speakers")
    .update({ full_name: toName })
    .eq("full_name", fromName);
  if (error) console.log(`  ✗ "${fromName}" → "${toName}": ${error.message}`);
  else console.log(`  ✓ "${fromName}" → "${toName}"`);
}

async function main() {
  console.log("== Merges ==");
  for (const [dropN, keepN] of MERGES) await mergePair(dropN, keepN);
  console.log("\n== Renames ==");
  for (const [from, to] of Object.entries(RENAMES)) await rename(from, to);
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
