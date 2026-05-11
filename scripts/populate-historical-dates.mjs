// Walks all four years of historical lists, matches each entry to a current
// speaker (using the same alias maps as the per-year backfills + name renames
// the user confirmed), and writes every matched date into the speaker's
// historical_dates JSON column. Idempotent — array is rewritten on each run.

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

// All historical entries (name as the user wrote, ISO date).
const ALL_PAST = [
  // ---- 2023 ----
  ["Matt Tippets", "2023-05-14"],
  ["ben tippets", "2023-05-21"],
  ["Mrs Quigley", "2023-05-21"],
  ["Jerry Teel", "2023-05-28"],
  ["Porter Christensen", "2023-06-18"],
  ["Beth Morrill", "2023-06-25"],
  ["Nate Cote", "2023-07-09"],
  ["Shana Boot", "2023-07-09"],
  ["Porter Christensen", "2023-07-23"],
  ["Cathy Bannister", "2023-07-23"],
  ["Issac Teel", "2023-07-30"],
  ["Ralph Bradley", "2023-07-30"],
  ["James Copeland", "2023-08-13"],
  ["David Copeland", "2023-08-20"],
  ["Larry Dean", "2023-08-20"],
  ["Kingston Childs", "2023-08-27"],
  ["Amber Cote", "2023-08-27"],
  ["Theresa Lakey", "2023-08-27"],
  ["Matt Tippets", "2023-09-24"],
  ["Ben Tippets", "2023-10-15"],
  ["Jeannette Pitcher", "2023-10-15"],
  ["Steven Parker", "2023-10-22"],
  ["Elizabeth Meek", "2023-11-12"],
  ["Mark Mitchell", "2023-11-12"],
  ["Kaiden Glenn", "2023-11-26"],
  ["Kathleen Loyd", "2023-12-31"],
  ["Darin Hardin", "2023-12-31"],
  // ---- 2024 ----
  ["Max Christensen", "2024-01-21"],
  ["Ben Tippets", "2024-01-28"],
  ["Kingston Childs", "2024-02-11"],
  ["JulievBlanchard", "2024-02-11"],
  ["Phil Copeland", "2024-02-11"],
  ["Isaac Teel", "2024-02-18"],
  ["Rick Christensen", "2024-02-18"],
  ["James Copeland", "2024-03-10"],
  ["Nathan Cote", "2024-03-10"],
  ["Shanna Boot", "2024-03-10"],
  ["Lorelei Cote", "2024-03-17"],
  ["Kaitlyn Hardin", "2024-03-31"],
  ["Sis. Quigley", "2024-04-21"],
  ["Virginia Teel", "2024-04-21"],
  ["Larry Dean", "2024-04-21"],
  ["Lorelei Cote", "2024-04-28"],
  ["Kathleen Bannister", "2024-04-28"],
  ["Boston Childs", "2024-05-12"],
  ["Porter Christensen", "2024-05-19"],
  ["Shanna Boot", "2024-06-09"],
  ["Matt Tippets", "2024-06-23"],
  ["Mona Poe", "2024-06-23"],
  ["Porter Christensen", "2024-07-14"],
  ["Freda Wood", "2024-07-14"],
  ["Larry Dean", "2024-07-14"],
  ["Elder Keaton Childs", "2024-07-21"],
  ["President Boot", "2024-07-21"],
  ["Ben Tippets", "2024-07-28"],
  ["Mary Cote", "2024-08-11"],
  ["Amber Cote", "2024-08-11"],
  ["Katelyn Hardin", "2024-08-18"],
  ["Max Christenson", "2024-08-25"],
  ["Rachel Fields", "2024-08-25"],
  ["Mark Mitchell", "2024-08-25"],
  ["Kingston Childs", "2024-09-08"],
  ["Pres. Boot", "2024-09-08"],
  ["Porter Christiansen", "2024-09-22"],
  ["James Copeland", "2024-10-13"],
  ["Mark Mitchell", "2024-10-13"],
  ["Virginia Teel", "2024-10-27"],
  ["Max Christensen", "2024-11-10"],
  ["Sandi Mitchell", "2024-11-10"],
  ["Lorelei Cody", "2024-11-17"],
  ["Phil Copeland", "2024-11-24"],
  ["Sister Beth Morril", "2024-11-24"],
  ["Kaiden Glen", "2024-12-08"],
  ["Bro McWilliams", "2024-12-08"],
  ["Phil Copeland", "2024-12-15"],
  ["Larry Dean", "2024-12-15"],
  ["Brother Phillip Copeland", "2024-12-15"],
  ["Craig Childs", "2024-12-29"],
  ["Cathy Bannister", "2024-12-29"],
  // ---- 2025 ----
  ["Dash Christensen", "2025-01-19"],
  ["Sis Dean", "2025-01-19"],
  ["Virginia Teel", "2025-01-26"],
  ["Nate Cote", "2025-02-09"],
  ["Lori Tippets", "2025-02-09"],
  ["Danny Tippets", "2025-02-16"],
  ["Amber cote", "2025-02-16"],
  ["Huffstutler", "2025-02-16"],
  ["Harrison Hardin", "2025-02-23"],
  ["Elder 1", "2025-02-23"],
  ["Elder 2", "2025-02-23"],
  ["Ben Tippets", "2025-03-09"],
  ["Rachel Fields", "2025-03-09"],
  ["President Boot", "2025-03-16"],
  ["James Copeland", "2025-04-13"],
  ["Sister Loyd", "2025-04-13"],
  ["Mary Cote", "2025-04-20"],
  ["Julie Blanchard", "2025-04-20"],
  ["Cathy Bannister", "2025-04-20"],
  ["Virginia Teel", "2025-04-27"],
  ["Bro Parker", "2025-04-27"],
  ["Porter Christensen", "2025-05-11"],
  ["Lorelei Cote", "2025-05-18"],
  ["Sister Copeland", "2025-05-18"],
  ["KG Pederson", "2025-05-18"],
  ["Rick Christensen", "2025-05-25"],
  ["Matt Tippets", "2025-06-08"],
  ["Mark Mitchell", "2025-06-08"],
  ["Ella Copeland", "2025-06-15"],
  ["Harrison Hardin", "2025-06-22"],
  ["Phil Copeland", "2025-06-29"],
  ["President Boot", "2025-06-29"],
  ["Copeland", "2025-07-20"],
  ["Danny Tippets", "2025-08-24"],
  ["Lori Tippets", "2025-08-24"],
  ["Friggle, J.", "2025-08-24"],
  ["Ella Copeland", "2025-08-31"],
  ["Sister Loyd", "2025-08-31"],
  ["Craig Childs", "2025-08-31"],
  ["Isiac Teal", "2025-09-14"],
  ["Morrill, Beth", "2025-09-14"],
  ["Dash Christenson", "2025-10-12"],
  ["Dan McWilliams", "2025-10-12"],
  ["Lorelei Cote", "2025-10-19"],
  ["Sister Child's", "2025-10-19"],
  ["Virginia Teel", "2025-11-16"],
  ["Phil Copeland Jr", "2025-11-23"],
  ["Nate Cote", "2025-11-23"],
  ["Rick Christensen", "2025-11-23"],
  ["Eli Teel", "2025-11-30"],
  ["Shanna Boot", "2025-11-30"],
  ["Mark Mitchell", "2025-11-30"],
  ["James Copeland", "2025-12-14"],
  ["Sis Copeland", "2025-12-14"],
  ["Bro Childs", "2025-12-14"],
  ["Eva Chrsitensen", "2025-12-28"],
  ["Sis Story", "2025-12-28"],
  ["Sis Lackey", "2025-12-28"],
  // ---- 2026 (Jan–May; same data we backfilled originally) ----
  ["Harrison Hardin", "2026-01-11"],
  ["Ann Marie Acevedo", "2026-01-11"],
  ["Blanchard", "2026-01-11"],
  ["Kaitlyn Hardin", "2026-01-18"],
  ["Max Christenson", "2026-01-18"],
  ["Larry Dean", "2026-01-18"],
  ["Kaiden Glen", "2026-01-25"],
  ["Stone", "2026-01-25"],
  ["Bro Childs", "2026-01-25"],
  ["Kingston Child", "2026-02-08"],
  ["Sis. Almon", "2026-02-08"],
  ["Shanna Boot", "2026-02-08"],
  ["Boston Childs", "2026-02-15"],
  ["Dash Christensen", "2026-02-22"],
  ["Bro Bradley", "2026-02-22"],
  ["Sis Childs", "2026-02-22"],
  ["Virginia Teel", "2026-03-08"],
  ["Marry Cote", "2026-03-08"],
  ["Sis Bannister", "2026-03-08"],
  ["Ava Christensen", "2026-03-29"],
  ["Matt Tippets", "2026-03-29"],
  ["Pres Boot", "2026-03-29"],
  ["Max Christensen", "2026-04-12"],
  ["Sis Copeland", "2026-04-12"],
  ["Larry Dean", "2026-04-12"],
  ["Isaac Teel", "2026-04-19"],
  ["Sis Corbin", "2026-04-19"],
  ["Sis Dean", "2026-04-19"],
  ["Eli Teel", "2026-04-26"],
  ["Nathan Cote", "2026-04-26"],
  ["Rick Christensen", "2026-04-26"],
  ["Elder Shatzer", "2026-05-10"],
  ["Amber Cote", "2026-05-10"],
  ["Sis Hardin", "2026-05-10"],
];

// Maps 2024–2025 names to the renamed current roster.
const ALIASES = {
  "ben tippets": "Ben Tippets",
  "shana boot": "Shanna Boot",
  "issac teel": "Isaac Teel",
  "katelyn hardin": "Kaitlyn Hardin",
  "cathy bannister": "Sis Bannister",
  "kathleen bannister": "Sis Bannister",
  "beth morrill": "B. Morrill",
  "morrill, beth": "B. Morrill",
  "sister beth morril": "B. Morrill",
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
  "sister loyd": "Sis Loyd",
  "jeannette pitcher": "Sis Pitcher",
  "mrs quigley": "Sis Quigley",
  "sis. quigley": "Sis Quigley",
  "amber cote": "Amber Cote",
  "mary cote": "Marry Cote",
  "marry cote": "Marry Cote",
  "julievblanchard": "Sis. Jullie Blanchard",
  "julie blanchard": "Sis. Jullie Blanchard",
  "blanchard": "Sis Blanchard",
  "phil copeland": "Phillip Copeland",
  "brother phillip copeland": "Phillip Copeland",
  "phil copeland jr": "Little Phil Copeland",
  "copeland": "Little Phil Copeland",
  "elder keaton childs": "Keaton Childs",
  "pres. boot": "Pres Boot",
  "president boot": "Pres Boot", // merged
  "porter christiansen": "Porter Christensen",
  "max christenson": "Max Christenson",
  "max christensen": "Max Christensen",
  "lorelei cody": "Lorelei Cote",
  "dash christenson": "Dash Christensen",
  "kg pederson": "Pedersen",
  "huffstutler": "R. Huffstutler",
  "friggle, j.": "J. Friggle",
  "craig childs": "Bro Craig Childs",
  "bro childs": "Bro Craig Childs",
  "stone": "Sis. Stone",
  "isiac teal": "Isaac Teel",
  "dan mcwilliams": "Bro. Daniel McWilliams",
  "bro mcwilliams": "Bro. Daniel McWilliams",
  "sister child's": "Sis Childs",
  "sis child's": "Sis Childs",
  "eva chrsitensen": "Eva Christensen",
  "sister copeland": "Sis Copeland",
  // 2025-renamed people
  "sis poe": "Mona Poe",
  "sis wood": "Freda Wood",
  "sis mitchell": "Sandy Mitchell",
  "sandi mitchell": "Sandy Mitchell",
  "christensen, a.": "Amanda Christensen",
  "sis teel": "Rebekah Teel",
  "elder tippets": "Matt Tippets",
  "elder boston childs": "Boston Childs",
  "bro larry dean": "Larry Dean",
  "bro hardin": "Darin Hardin",
};

async function main() {
  const { data: speakers } = await admin
    .from("speakers")
    .select("id, full_name");
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

  // Build map: speaker_id → Set<date>
  const datesBySpeaker = new Map();
  const unmatched = [];
  for (const [name, date] of ALL_PAST) {
    const s = findSpeaker(name);
    if (!s) {
      unmatched.push(`${name} (${date})`);
      continue;
    }
    if (!datesBySpeaker.has(s.id)) datesBySpeaker.set(s.id, new Set());
    datesBySpeaker.get(s.id).add(date);
  }

  console.log(`Writing historical_dates for ${datesBySpeaker.size} speakers...`);
  for (const [id, set] of datesBySpeaker) {
    const sorted = [...set].sort().reverse(); // newest first
    const { error } = await admin
      .from("speakers")
      .update({ historical_dates: sorted })
      .eq("id", id);
    if (error) console.log(`  ✗ ${id}: ${error.message}`);
  }

  console.log(`Done. ${unmatched.length} unmatched entries:`);
  for (const u of unmatched) console.log(`  · ${u}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
