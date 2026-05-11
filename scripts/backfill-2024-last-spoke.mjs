// Same pattern as 2025 backfill, for 2024 talks. Most matches will be no-ops
// because 2025/2026 dates are newer — this fills in only the speakers who are
// in the current roster but haven't spoken since 2024.

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

const PAST_2024 = [
  ["Jayden Fields", "2024-01-14"],
  ["Angel Hardin", "2024-01-14"],
  ["Mandy Christensen", "2024-01-14"],
  ["Max Christensen", "2024-01-21"],
  ["Brandi Little", "2024-01-21"],
  ["Cody Glen", "2024-01-21"],
  ["Ben Tippets", "2024-01-28"],
  ["Roxanne Cote", "2024-01-28"],
  ["Tana'e Cilds", "2024-01-28"],
  ["Kingston Childs", "2024-02-11"],
  ["JulievBlanchard", "2024-02-11"],
  ["Phil Copeland", "2024-02-11"],
  ["Isaac Teel", "2024-02-18"],
  ["Michelle Glen", "2024-02-18"],
  ["Rick Christensen", "2024-02-18"],
  ["James Copeland", "2024-03-10"],
  ["Nathan Cote", "2024-03-10"],
  ["Shanna Boot", "2024-03-10"],
  ["Lorelei Cote", "2024-03-17"],
  ["Annette Strickland", "2024-03-17"],
  ["Bro Quigley", "2024-03-17"],
  ["Kaitlyn Hardin", "2024-03-31"],
  ["Sis. Nye", "2024-03-31"],
  ["Elder Nye", "2024-03-31"],
  ["Dave Copeland", "2024-04-14"],
  ["Dawn Parker", "2024-04-14"],
  ["Bro. Quigley", "2024-04-14"],
  ["Virginia Teel", "2024-04-21"],
  ["Sis. Quigley", "2024-04-21"],
  ["Larry Dean", "2024-04-21"],
  ["Lorelei Cote", "2024-04-28"],
  ["Kathleen Bannister", "2024-04-28"],
  ["Lori Tippets", "2024-04-28"],
  ["Boston Childs", "2024-05-12"],
  ["Rebecca Meek", "2024-05-12"],
  ["Jennifer Dean", "2024-05-12"],
  ["Porter Christensen", "2024-05-19"],
  ["Sister McInnis", "2024-05-19"],
  ["Sister Wasden", "2024-05-19"],
  ["Henry Teel", "2024-05-26"],
  ["Rowena Stone", "2024-05-26"],
  ["Theresa Lackey", "2024-05-26"],
  ["Phil Copeland Jr", "2024-06-09"],
  ["Shanna Boot", "2024-06-09"],
  ["L.Tippetts", "2024-06-09"],
  ["Trey Christensen", "2024-06-16"],
  ["Sis Rowland", "2024-06-16"],
  ["Bro Rowland", "2024-06-16"],
  ["Matt Tippets", "2024-06-23"],
  ["Mona Poe", "2024-06-23"],
  ["Brother Mann", "2024-06-23"],
  ["Oliver Boot", "2024-06-30"],
  ["Rebecca Teel", "2024-06-30"],
  ["Jerry Teel", "2024-06-30"],
  ["Porter Christensen", "2024-07-14"],
  ["Freda Wood", "2024-07-14"],
  ["Larry Dean", "2024-07-14"],
  ["Elder Keaton Childs", "2024-07-21"],
  ["President Boot", "2024-07-21"],
  ["President Cote", "2024-07-21"],
  ["Ben Tippets", "2024-07-28"],
  ["Sister Nigh", "2024-07-28"],
  ["Elder Nigh", "2024-07-28"],
  ["Mary Cote", "2024-08-11"],
  ["Amber Cote", "2024-08-11"],
  ["Steve Parker", "2024-08-11"],
  ["Katelyn Hardin", "2024-08-18"],
  ["Angel Hardin", "2024-08-18"],
  ["Luis Pagan", "2024-08-18"],
  ["Max Christenson", "2024-08-25"],
  ["Rachel Fields", "2024-08-25"],
  ["Mark Mitchell", "2024-08-25"],
  ["Kingston Childs", "2024-09-08"],
  ["Rebecca Meek", "2024-09-08"],
  ["Pres. Boot", "2024-09-08"],
  ["Porter Christiansen", "2024-09-22"],
  ["Betsy Sheppard", "2024-09-22"],
  ["Amanda Christensen", "2024-09-22"],
  ["James Copeland", "2024-10-13"],
  ["Kathy Loyd", "2024-10-13"],
  ["Mark Mitchell", "2024-10-13"],
  ["Virginia Teel", "2024-10-27"],
  ["Sister Holyoak", "2024-10-27"],
  ["Bubba Teel", "2024-10-27"],
  ["Max Christensen", "2024-11-10"],
  ["Sandi Mitchell", "2024-11-10"],
  ["Duane Tippets", "2024-11-10"],
  ["Lorelei Cody", "2024-11-17"],
  ["Tana'e Childs", "2024-11-17"],
  ["Brother Armstrong", "2024-11-17"],
  ["Phil Copeland", "2024-11-24"],
  ["Sister Beth Morril", "2024-11-24"],
  ["President Cote", "2024-11-24"],
  ["Kaiden Glen", "2024-12-08"],
  ["Bro McWilliams", "2024-12-08"],
  ["Angel Hardin", "2024-12-08"],
  ["Phil Copeland", "2024-12-15"],
  ["Larry Dean", "2024-12-15"],
  ["Brother Phillip Copeland", "2024-12-15"],
  ["Craig Childs", "2024-12-29"],
  ["Cathy Bannister", "2024-12-29"],
];

const latest = new Map();
for (const [name, date] of PAST_2024) {
  const prev = latest.get(name);
  if (!prev || date > prev) latest.set(name, date);
}

const ALIASES = {
  "kingston childs": "Kingston Child",
  "julievblanchard": "Sis. Jullie Blanchard",
  "phil copeland": "Phillip Copeland",
  "sis. quigley": "Sis Quigley",
  "lorelei cody": "Lorelei Cote", // typo
  "porter christiansen": "Porter Christensen", // typo
  "katelyn hardin": "Kaitlyn Hardin",
  "max christenson": "Max Christenson",
  "max christensen": "Max Christensen",
  "mary cote": "Marry Cote",
  "amber cote": "Amber Cote",
  "elder keaton childs": "Keaton Childs",
  "pres. boot": "Pres Boot",
  "kathleen bannister": "Sis Bannister",
  "cathy bannister": "Sis Bannister",
  "sister beth morril": "B. Morrill",
  "bro mcwilliams": "Bro. Daniel McWilliams",
  "brother phillip copeland": "Phillip Copeland",
  "craig childs": "Bro Craig Childs",
  "mark mitchell": "Bro. Mark Mitchell",
  "tana'e childs": null, // not in roster, treat as missing
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
      return null;
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

  console.log(`\nKept existing newer date for ${skippedNewer.length}.`);
  console.log(`\nNo match in roster (${missing.length}):`);
  for (const m of missing) console.log(`  · ${m}`);

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
