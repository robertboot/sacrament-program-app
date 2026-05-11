// Backfill last_spoke_date from the 2025 schedule. Computes the most recent
// 2025 appearance per speaker, name-matches against the current roster (with
// fuzzy aliases for renamed entries), and patches last_spoke_date — but only
// when the proposed date is later than what's already stored (so the 2026
// backfill we already did wins where it should).

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

const PAST_2025 = [
  // Jan
  ["Oliver Boot", "2025-01-12"],
  ["Bro Pitcher", "2025-01-12"],
  ["Sis Pitcher", "2025-01-12"],
  ["Dash Christensen", "2025-01-19"],
  ["Sis Dean", "2025-01-19"],
  ["Virginia Teel", "2025-01-26"],
  ["Sis Roland", "2025-01-26"],
  ["Bro Roland", "2025-01-26"],
  // Feb
  ["Jacob Boot", "2025-02-09"],
  ["Nate Cote", "2025-02-09"],
  ["Lori Tippets", "2025-02-09"],
  ["Danny Tippets", "2025-02-16"],
  ["Amber cote", "2025-02-16"],
  ["Huffstutler", "2025-02-16"],
  ["Harrison Hardin", "2025-02-23"],
  ["Elder 1", "2025-02-23"],
  ["Elder 2", "2025-02-23"],
  // Mar
  ["Ben Tippets", "2025-03-09"],
  ["Rachel Fields", "2025-03-09"],
  ["Tenea Childs", "2025-03-09"],
  ["President Boot", "2025-03-16"],
  ["President Cote", "2025-03-16"],
  // Apr
  ["James Copeland", "2025-04-13"],
  ["Brother Loyd", "2025-04-13"],
  ["Sister Loyd", "2025-04-13"],
  ["Mary Cote", "2025-04-20"],
  ["Julie Blanchard", "2025-04-20"],
  ["Cathy Bannister", "2025-04-20"],
  ["Virginia Teel", "2025-04-27"],
  ["Sis Parker", "2025-04-27"],
  ["Bro Parker", "2025-04-27"],
  // May
  ["Porter Christensen", "2025-05-11"],
  ["Sister Glen", "2025-05-11"],
  ["Angel Hardin", "2025-05-11"],
  ["Lorelei Cote", "2025-05-18"],
  ["Sister Copeland", "2025-05-18"],
  ["KG Pederson", "2025-05-18"],
  ["Trey Christensen", "2025-05-25"],
  ["Amanda Christensen", "2025-05-25"],
  ["Rick Christensen", "2025-05-25"],
  // Jun
  ["Matt Tippets", "2025-06-08"],
  ["Sister Patterson", "2025-06-08"],
  ["Mark Mitchell", "2025-06-08"],
  ["Ella Copeland", "2025-06-15"],
  ["Sis Cote", "2025-06-15"],
  ["Brother Quigley", "2025-06-15"],
  ["Harrison Hardin", "2025-06-22"],
  ["Emily Gleaves", "2025-06-22"],
  ["Ian Gleaves", "2025-06-22"],
  ["Phil Copeland", "2025-06-29"],
  ["Elder Oliver Boot", "2025-06-29"],
  ["President Boot", "2025-06-29"],
  // Jul
  ["Max", "2025-07-13"],
  ["Rowena Stone", "2025-07-13"],
  ["Sister Davis", "2025-07-13"],
  ["Boston", "2025-07-20"],
  ["Elder Maynard", "2025-07-20"],
  ["Copeland", "2025-07-20"],
  ["Pres Tippets", "2025-07-27"],
  ["Pres shepherd", "2025-07-27"],
  ["Pres Cote", "2025-07-27"],
  // Aug
  ["Sister Missionary Cummings", "2025-08-10"],
  ["Elder Missionary Shumway", "2025-08-10"],
  ["Danny Tippets", "2025-08-24"],
  ["Lori Tippets", "2025-08-24"],
  ["Friggle, J.", "2025-08-24"],
  ["Ella Copeland", "2025-08-31"],
  ["Sister Loyd", "2025-08-31"],
  ["Craig Childs", "2025-08-31"],
  // Sep
  ["Isiac Teal", "2025-09-14"],
  ["Michelle Holland", "2025-09-14"],
  ["Morrill, Beth", "2025-09-14"],
  // Oct
  ["Dash Christenson", "2025-10-12"],
  ["Dan McWilliams", "2025-10-12"],
  ["Angel Hardin", "2025-10-12"],
  ["Lorelei Cote", "2025-10-19"],
  ["Sister Child's", "2025-10-19"],
  ["HC Michael Hall", "2025-10-19"],
  // Nov
  ["Virginia Teel", "2025-11-16"],
  ["Elder Dannenberg", "2025-11-16"],
  ["Elder Adams", "2025-11-16"],
  ["Phil Copeland Jr", "2025-11-23"],
  ["Nate Cote", "2025-11-23"],
  ["Rick Christensen", "2025-11-23"],
  ["Eli Teel", "2025-11-30"],
  ["Shanna Boot", "2025-11-30"],
  ["Mark Mitchell", "2025-11-30"],
  // Dec
  ["James Copeland", "2025-12-14"],
  ["Sis Copeland", "2025-12-14"],
  ["Bro Childs", "2025-12-14"],
  // Dec 21 – single last names, ambiguous (likely bishopric conducting), skipping
  ["Eva Chrsitensen", "2025-12-28"],
  ["Sis Story", "2025-12-28"],
  ["Sis Lackey", "2025-12-28"],
];

// Reduce to the most recent 2025 date per name.
const latest = new Map();
for (const [name, date] of PAST_2025) {
  const prev = latest.get(name);
  if (!prev || date > prev) latest.set(name, date);
}

// Manual aliases: 2025 name (lowercased) → current speaker.full_name.
const ALIASES = {
  "amber cote": "Amber Cote",
  "mary cote": "Marry Cote", // user's 2026 schedule used "Marry"
  "julie blanchard": "Sis. Jullie Blanchard",
  "cathy bannister": "Sis Bannister",
  "sister copeland": "Sis Copeland",
  "sister loyd": "Sis Loyd",
  "phil copeland": "Phillip Copeland",
  "mark mitchell": "Bro. Mark Mitchell",
  "friggle, j.": "J. Friggle",
  "craig childs": "Bro Craig Childs",
  "isiac teal": "Isaac Teel", // typo
  "morrill, beth": "B. Morrill",
  "dan mcwilliams": "Bro. Daniel McWilliams",
  "sister child's": "Sis Childs",
  "eva chrsitensen": "Eva Christensen", // typo
  "kg pederson": "Pedersen",
  "huffstutler": "R. Huffstutler",
  "nate cote": "Nathan Cote",
  "boston": "Boston Childs",
  "bro childs": "Bro Craig Childs",
  "dash christenson": "Dash Christensen", // typo on Oct 12
};

async function main() {
  const { data: speakers } = await admin
    .from("speakers")
    .select("id, full_name, last_spoke_date");
  const byExact = new Map(speakers.map((s) => [s.full_name.toLowerCase(), s]));

  function findSpeaker(name) {
    const key = name.toLowerCase().trim();
    if (byExact.has(key)) return byExact.get(key);
    const aliased = ALIASES[key];
    if (aliased && byExact.has(aliased.toLowerCase()))
      return byExact.get(aliased.toLowerCase());
    return null;
  }

  const updates = [];
  const skippedNewer = [];
  const missing = [];
  for (const [name, date] of latest) {
    const speaker = findSpeaker(name);
    if (!speaker) {
      missing.push(name);
      continue;
    }
    if (speaker.last_spoke_date && speaker.last_spoke_date >= date) {
      skippedNewer.push(`${name} → ${speaker.full_name} (kept ${speaker.last_spoke_date})`);
      continue;
    }
    updates.push({ id: speaker.id, full_name: speaker.full_name, date });
  }

  console.log(`Matched & updating: ${updates.length}`);
  for (const u of updates) {
    const { error } = await admin
      .from("speakers")
      .update({ last_spoke_date: u.date })
      .eq("id", u.id);
    if (error) console.log(`  ✗ ${u.full_name} (${u.date}): ${error.message}`);
    else console.log(`  ✓ ${u.full_name} → ${u.date}`);
  }

  console.log(`\nKept existing newer date for ${skippedNewer.length}:`);
  for (const s of skippedNewer) console.log(`  · ${s}`);

  console.log(`\nNo match in roster (${missing.length} — would need to add manually):`);
  for (const m of missing) console.log(`  · ${m}`);

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
