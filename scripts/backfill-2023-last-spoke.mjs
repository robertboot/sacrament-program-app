// 2023 backfill — same pattern. Yield will be small because most active
// speakers have spoken since 2023. Still useful for the holdouts.

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

const PAST_2023 = [
  ["Matt Tippets", "2023-05-14"],
  ["Ollie Boot", "2023-05-14"],
  ["Mrs Blanchard", "2023-05-14"],
  ["ben tippets", "2023-05-21"],
  ["Mrs Quigley", "2023-05-21"],
  ["Amelia Gaddis", "2023-05-28"],
  ["Brandi Little", "2023-05-28"],
  ["Jerry Teel", "2023-05-28"],
  ["Sofia Boot", "2023-06-11"],
  ["Elder Collins", "2023-06-11"],
  ["Annelies Boot", "2023-06-11"],
  ["Porter Christensen", "2023-06-18"],
  ["Rebekah Teel", "2023-06-18"],
  ["Peter Cote", "2023-06-18"],
  ["Katelyn Hardin", "2023-06-25"],
  ["Angel Hardin", "2023-06-25"],
  ["Beth Morrill", "2023-06-25"],
  ["Trey Christensen", "2023-07-09"],
  ["Nate Cote", "2023-07-09"],
  ["Shana Boot", "2023-07-09"],
  ["Oliver Boot", "2023-07-16"],
  ["Sister Chibota", "2023-07-16"],
  ["President Chibota", "2023-07-16"],
  ["Porter Christensen", "2023-07-23"],
  ["Freda Wood", "2023-07-23"],
  ["Cathy Bannister", "2023-07-23"],
  ["Issac Teel", "2023-07-30"],
  ["Ralph Bradley", "2023-07-30"],
  ["Tom Loyd", "2023-07-30"],
  ["James Copeland", "2023-08-13"],
  ["Rebecca Meek", "2023-08-13"],
  ["Lori Tippets", "2023-08-13"],
  ["David Copeland", "2023-08-20"],
  ["Jason Hopper", "2023-08-20"],
  ["Larry Dean", "2023-08-20"],
  ["Kingston Childs", "2023-08-27"],
  ["Amber Cote", "2023-08-27"],
  ["Theresa Lakey", "2023-08-27"],
  ["Pres Sheppard", "2023-09-10"],
  ["Pres Tippets", "2023-09-10"],
  ["Pres Cote", "2023-09-10"],
  ["Matt Tippets", "2023-09-24"],
  ["Duane Tippets", "2023-09-24"],
  ["Ben Tippets", "2023-10-15"],
  ["Jeannette Pitcher", "2023-10-15"],
  ["Dawn Parker", "2023-10-22"],
  ["Steven Parker", "2023-10-22"],
  ["Tatiana Morris", "2023-10-29"],
  ["Sandi Mitchell", "2023-10-29"],
  ["Clair Pitcher", "2023-10-29"],
  ["Elizabeth Meek", "2023-11-12"],
  ["Michele Glenn", "2023-11-12"],
  ["Mark Mitchell", "2023-11-12"],
  ["Kaiden Glenn", "2023-11-26"],
  ["Elder Smith", "2023-11-26"],
  ["Jakob Boot", "2023-12-17"],
  ["Kathleen Lloyd", "2023-12-17"],
  ["Helms", "2023-12-17"],
  ["Oliver Boot", "2023-12-31"],
  ["Kathleen Loyd", "2023-12-31"],
  ["Darin Hardin", "2023-12-31"],
];

const latest = new Map();
for (const [name, date] of PAST_2023) {
  const prev = latest.get(name);
  if (!prev || date > prev) latest.set(name, date);
}

const ALIASES = {
  "ben tippets": "Ben Tippets",
  "shana boot": "Shanna Boot",
  "issac teel": "Isaac Teel",
  "katelyn hardin": "Kaitlyn Hardin",
  "cathy bannister": "Sis Bannister",
  "beth morrill": "B. Morrill",
  "nate cote": "Nathan Cote",
  "theresa lakey": "Sis Lackey",
  "kaiden glenn": "Kaiden Glen",
  "kingston childs": "Kingston Child",
  "mark mitchell": "Bro. Mark Mitchell",
  "jerry teel": "Bro Jerry Teel",
  "ralph bradley": "Bro Bradley",
  "steven parker": "Bro Parker",
  "kathleen loyd": "Sis Loyd",
  "kathleen lloyd": "Sis Loyd",
  "jeannette pitcher": "Sis Pitcher",
  "mrs quigley": "Sis Quigley",
  "mrs blanchard": "Sis Blanchard",
};

async function main() {
  const { data: speakers } = await admin
    .from("speakers")
    .select("id, full_name, last_spoke_date");
  const byExact = new Map(speakers.map((s) => [s.full_name.toLowerCase(), s]));

  function findSpeaker(name) {
    const key = name.toLowerCase().trim();
    if (byExact.has(key)) return byExact.get(key);
    if (key in ALIASES) {
      const aliased = ALIASES[key];
      if (aliased && byExact.has(aliased.toLowerCase()))
        return byExact.get(aliased.toLowerCase());
    }
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
      skippedNewer.push(name);
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

  console.log(`\nKept existing newer date for ${skippedNewer.length}.`);
  console.log(`\nNo match in roster (${missing.length}):`);
  for (const m of missing) console.log(`  · ${m}`);

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
