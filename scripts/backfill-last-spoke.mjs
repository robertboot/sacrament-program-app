// One-off: backfill last_spoke_date for the speakers who spoke between Jan 11
// and Apr 26, 2026, before this app existed. Uses the user-supplied list of
// past assignments, takes the latest date per speaker, fuzzy-matches by name.

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

// Past assignments — names exactly as the user provided them, plus the date.
const PAST = [
  // Jan 11
  ["Harrison Hardin", "2026-01-11"],
  ["Ann Marie Acevedo", "2026-01-11"],
  ["Blanchard", "2026-01-11"],
  // Jan 18
  ["Kaitlyn Hardin", "2026-01-18"],
  ["Max Christenson", "2026-01-18"],
  ["Larry Dean", "2026-01-18"],
  // Jan 25
  ["Kaiden Glen", "2026-01-25"],
  ["Stone", "2026-01-25"],
  ["Bro Childs", "2026-01-25"],
  // Feb 8
  ["Kingston Child", "2026-02-08"],
  ["Sis. Almon", "2026-02-08"],
  ["Shanna Boot", "2026-02-08"],
  // Feb 15
  ["Boston Childs", "2026-02-15"],
  // Feb 22
  ["Dash Christensen", "2026-02-22"],
  ["Bro Bradley", "2026-02-22"],
  ["Sis Childs", "2026-02-22"],
  // Mar 8
  ["Virginia Teel", "2026-03-08"],
  ["Marry Cote", "2026-03-08"],
  ["Sis Bannister", "2026-03-08"],
  // Mar 29
  ["Ava Christensen", "2026-03-29"],
  ["Matt Tippets", "2026-03-29"],
  ["Pres Boot", "2026-03-29"],
  // Apr 12
  ["Max Christensen", "2026-04-12"],
  ["Sis Copeland", "2026-04-12"],
  ["Larry Dean", "2026-04-12"],
  // Apr 19
  ["Isaac Teel", "2026-04-19"],
  ["Sis Corbin", "2026-04-19"],
  ["Sis Dean", "2026-04-19"],
  // Apr 26
  ["Eli Teel", "2026-04-26"],
  ["Nathan Cote", "2026-04-26"],
  ["Rick Chrirtensen", "2026-04-26"],
];

// Reduce to most recent date per name.
const latest = new Map();
for (const [name, date] of PAST) {
  const prev = latest.get(name);
  if (!prev || date > prev) latest.set(name, date);
}

async function main() {
  const { data: speakers } = await admin
    .from("speakers")
    .select("id, full_name, last_spoke_date");

  const byExact = new Map(speakers.map((s) => [s.full_name.toLowerCase(), s]));

  // Manual aliases for names the user has since refined.
  const ALIASES = {
    "blanchard": "Sis Blanchard",
    "stone": "Sis. Stone",
    "bro childs": "Bro Craig Childs",
    "rick chrirtensen": "Rick Christensen", // typo fix
  };

  function findSpeaker(name) {
    const key = name.toLowerCase().trim();
    if (byExact.has(key)) return byExact.get(key);
    const aliased = ALIASES[key];
    if (aliased && byExact.has(aliased.toLowerCase()))
      return byExact.get(aliased.toLowerCase());
    return null;
  }

  const updates = [];
  const missing = [];
  for (const [name, date] of latest) {
    const speaker = findSpeaker(name);
    if (!speaker) {
      missing.push(name);
      continue;
    }
    // Only update if the new date is later than what's already set.
    if (speaker.last_spoke_date && speaker.last_spoke_date >= date) {
      continue;
    }
    updates.push({ id: speaker.id, full_name: speaker.full_name, date });
  }

  console.log(`Found ${updates.length} updates.`);
  console.log(`Could not match: ${missing.join(", ") || "(none)"}`);

  for (const u of updates) {
    const { error } = await admin
      .from("speakers")
      .update({ last_spoke_date: u.date })
      .eq("id", u.id);
    if (error) console.log(`  ✗ ${u.full_name} (${u.date}): ${error.message}`);
    else console.log(`  ✓ ${u.full_name} → ${u.date}`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
