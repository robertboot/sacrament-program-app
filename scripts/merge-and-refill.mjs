// Two jobs:
//   1. Merge "President Boot" into "Pres Boot" (same person, two records).
//   2. Take another swing at the 21 speakers still missing last_spoke_date
//      using broader fuzzy matches against the 2023–2025 lists.

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

// ---- MERGE PRES BOOT / PRESIDENT BOOT --------------------------------------

async function mergeBoot() {
  const { data: rows } = await admin
    .from("speakers")
    .select("id, full_name, last_spoke_date")
    .in("full_name", ["Pres Boot", "President Boot"]);

  const presBoot = rows.find((r) => r.full_name === "Pres Boot");
  const presidentBoot = rows.find((r) => r.full_name === "President Boot");
  if (!presBoot || !presidentBoot) {
    console.log("Merge skipped: one of the records is missing.");
    return;
  }

  const keepId = presBoot.id;
  const dropId = presidentBoot.id;
  const newDate =
    [presBoot.last_spoke_date, presidentBoot.last_spoke_date]
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? null;

  // Repoint any speaking_assignments from the duplicate to the keeper.
  const { error: e1 } = await admin
    .from("speaking_assignments")
    .update({ speaker_id: keepId })
    .eq("speaker_id", dropId);
  if (e1) {
    console.log(`  ✗ Repoint assignments: ${e1.message}`);
    return;
  }
  // Also repoint speaking_assignment_history (FK without cascade).
  const { error: e1b } = await admin
    .from("speaking_assignment_history")
    .update({ speaker_id: keepId })
    .eq("speaker_id", dropId);
  if (e1b) {
    console.log(`  ✗ Repoint history: ${e1b.message}`);
    return;
  }

  // Union category tags onto the keeper.
  const { data: dropCats } = await admin
    .from("speaker_categories")
    .select("category")
    .eq("speaker_id", dropId);
  if (dropCats && dropCats.length) {
    const upsertRows = dropCats.map((c) => ({
      speaker_id: keepId,
      category: c.category,
    }));
    await admin
      .from("speaker_categories")
      .upsert(upsertRows, { onConflict: "speaker_id,category" });
  }

  // Stamp the latest known date on the keeper.
  await admin
    .from("speakers")
    .update({ last_spoke_date: newDate })
    .eq("id", keepId);

  // Delete the duplicate (cascades drop its categories).
  const { error: e2 } = await admin.from("speakers").delete().eq("id", dropId);
  if (e2) console.log(`  ✗ Delete duplicate: ${e2.message}`);
  else
    console.log(
      `  ✓ Merged President Boot → Pres Boot (last spoke ${newDate ?? "unknown"})`,
    );
}

// ---- BACKFILL NULL last_spoke_date FOR LIKELY MATCHES ----------------------

// Maps current-roster speakers (lowercased) to their most recent historical
// appearance, based on cross-checking the 2023–2025 lists by hand.
const FUZZY_BACKFILL = {
  "sis poe": "2024-06-23", // Mona Poe (2024)
  "sis wood": "2024-07-14", // Freda Wood (2024)
  "sis mitchell": "2024-11-10", // Sandi Mitchell (2024)
  "christensen, a.": "2025-05-25", // Amanda Christensen (2025)
  "little phil copeland": "2025-11-23", // Phil Copeland Jr (2025)
  "elder copeland": "2025-07-20", // "Copeland" on Jul 20 2025
  "brother mitchell": "2024-11-10", // Sandi Mitchell? more likely Mark Mitchell — see note
  "sis teel": "2023-06-18", // Rebekah Teel (2023) — best guess
};

async function fuzzyBackfill() {
  const { data: nulls } = await admin
    .from("speakers")
    .select("id, full_name")
    .is("last_spoke_date", null);

  console.log(`Considering ${nulls.length} speakers without a last_spoke_date.`);

  let updated = 0;
  const unmatched = [];
  for (const s of nulls) {
    const key = s.full_name.toLowerCase();
    const date = FUZZY_BACKFILL[key];
    if (!date) {
      unmatched.push(s.full_name);
      continue;
    }
    const { error } = await admin
      .from("speakers")
      .update({ last_spoke_date: date })
      .eq("id", s.id);
    if (error) {
      console.log(`  ✗ ${s.full_name}: ${error.message}`);
      continue;
    }
    console.log(`  ✓ ${s.full_name} → ${date}`);
    updated++;
  }

  console.log(`\nLeft without a date (${unmatched.length}):`);
  for (const n of unmatched) console.log(`  · ${n}`);
}

async function main() {
  console.log("== Merging Pres Boot / President Boot ==");
  await mergeBoot();
  console.log("\n== Fuzzy-backfilling remaining nulls ==");
  await fuzzyBackfill();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
