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

const MERGES = [
  ["Bro Larry Dean", "Larry Dean"],
  ["Elder Boston Childs", "Boston Childs"],
  ["Elder Tippets", "Matt Tippets"],
];

const RENAMES_WITH_DATES = [
  // { from, to, lastSpoke }
  { from: "Bro Hardin", to: "Darin Hardin", lastSpoke: "2023-12-31" },
];

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

  await admin
    .from("speaking_assignments")
    .update({ speaker_id: keep.id })
    .eq("speaker_id", drop.id);
  await admin
    .from("speaking_assignment_history")
    .update({ speaker_id: keep.id })
    .eq("speaker_id", drop.id);
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
  const { error } = await admin.from("speakers").delete().eq("id", drop.id);
  if (error) console.log(`  ✗ ${dropName} delete: ${error.message}`);
  else console.log(`  ✓ Merged "${dropName}" → "${keepName}" (last spoke ${newDate ?? "—"})`);
}

async function renameWithDate({ from, to, lastSpoke }) {
  const { error } = await admin
    .from("speakers")
    .update({ full_name: to, last_spoke_date: lastSpoke })
    .eq("full_name", from);
  if (error) console.log(`  ✗ "${from}" → "${to}": ${error.message}`);
  else console.log(`  ✓ "${from}" → "${to}" (set ${lastSpoke})`);
}

async function main() {
  console.log("== Merges ==");
  for (const [dropN, keepN] of MERGES) await mergePair(dropN, keepN);
  console.log("\n== Renames + date ==");
  for (const r of RENAMES_WITH_DATES) await renameWithDate(r);
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
