// One-time data load of the 2026 sacrament schedule.
// Run from project root:  node scripts/seed-schedule.mjs
//
// Reads .env.local for credentials. Idempotent: deletes & re-inserts programs
// for the 2026 dates listed below, plus any speakers/topics it needs.

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
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const TODAY = "2026-05-10";

// ============================================================================
// SCHEDULE DATA (2026)
// ============================================================================
// special: top-of-program note ("FAST SUNDAY", "STAKE CONFERENCE", etc).
// speakers: [{ name, topic, minutes }] in slot order (first/second/concluding).
// hymns: hymn numbers — `null` for "not set"; "Primary" etc. as string for intermediate.

const SCHEDULE = [
  // ---------------------------- JANUARY ----------------------------
  { date: "2026-01-04", conducting: "Boot", special: "FAST SUNDAY",
    hymns: { opening: 67, sacrament: 174, intermediate: null, closing: 19 } },
  { date: "2026-01-11", conducting: "Boot",
    hymns: { opening: 294, sacrament: 175, intermediate: 252, closing: 308 },
    speakers: [
      { name: "Harrison Hardin", topic: "Strengthening my faith during adversity", minutes: 5 },
      { name: "Ann Marie Acevedo", topic: "Being a living witness of Jesus Christ", minutes: 10 },
      { name: "Blanchard", topic: "Jesus Christ the Redeemer", minutes: 15 },
    ]},
  { date: "2026-01-18", conducting: "Boot",
    hymns: { opening: 84, sacrament: 180, intermediate: 48, closing: 61 },
    speakers: [
      { name: "Kaitlyn Hardin", topic: "Feeling the love of my Savior", minutes: 5 },
      { name: "Max Christenson", topic: "I know that Christ lives, what now?", minutes: 10 },
      { name: "Larry Dean", topic: null, minutes: 15 },
    ]},
  { date: "2026-01-25", conducting: "Boot",
    hymns: { opening: 74, sacrament: 193, intermediate: 263, closing: 142 },
    speakers: [
      { name: "Kaiden Glen", topic: "He is Risen!", minutes: 5 },
      { name: "Stone", topic: "Why does God work through prophets?", minutes: 10 },
      { name: "Bro Childs", topic: "Never give up an opportunity to serve your Heavenly Father", minutes: 15 },
    ]},

  // ---------------------------- FEBRUARY ---------------------------
  { date: "2026-02-01", conducting: "Hardin", special: "FAST SUNDAY",
    hymns: { opening: 17, sacrament: 182, intermediate: null, closing: 165 } },
  { date: "2026-02-08", conducting: "Hardin",
    hymns: { opening: 219, sacrament: 170, intermediate: 241, closing: 74 },
    speakers: [
      { name: "Kingston Child", topic: "Never give up an opportunity to serve your Heavenly Father", minutes: 5 },
      { name: "Sis. Almon", topic: "He lives!", minutes: 10 },
      { name: "Shanna Boot", topic: "Guilt, its spiritual impact and how to overcome", minutes: 15 },
    ]},
  { date: "2026-02-15", conducting: "Hardin",
    hymns: { opening: 147, sacrament: 185, intermediate: 226, closing: 23 },
    speakers: [
      { name: "Boston Childs", topic: "Fasting strengthens me spiritually", minutes: 5 },
      { name: null, topic: "Fulfilling Christ's invitation to Follow Me", minutes: 10 },
      { name: "Cahoon", topic: null, minutes: 15 },
    ]},
  { date: "2026-02-22", conducting: "Hardin",
    hymns: { opening: 116, sacrament: 195, intermediate: 237, closing: 113 },
    speakers: [
      { name: "Dash Christensen", topic: "A proper fast - who, how, why, and blessings", minutes: 5 },
      { name: "Bro Bradley", topic: "The gift of kindness", minutes: 10 },
      { name: "Sis Childs", topic: "Seek and ye shall find", minutes: 15 },
    ]},

  // ---------------------------- MARCH ------------------------------
  { date: "2026-03-01", conducting: "Dean", special: "FAST SUNDAY",
    hymns: { opening: 227, sacrament: 182, intermediate: null, closing: 165 } },
  { date: "2026-03-08", conducting: "Dean",
    hymns: { opening: 140, sacrament: 184, intermediate: 252, closing: 143 },
    speakers: [
      { name: "Virginia Teel", topic: "I will go; I will do", minutes: 5 },
      { name: "Marry Cote", topic: "Being honest in all my dealings", minutes: 10 },
      { name: "Sis Bannister", topic: "Judgment, mercy, and faith", minutes: 15 },
    ]},
  { date: "2026-03-15", conducting: "Boot", special: "BRANCH CONFERENCE",
    hymns: { opening: 58, sacrament: 182, intermediate: 19, closing: 81 } },
  { date: "2026-03-22", conducting: "Dean", special: "STAKE CONFERENCE" },
  { date: "2026-03-29", conducting: "Dean",
    hymns: { opening: 136, sacrament: 193, intermediate: 3, closing: "Amazing Grace" }, // 1010 -> title match
    speakers: [
      { name: "Ava Christensen", topic: "Discerning that which is good", minutes: 5 },
      { name: "Matt Tippets", topic: "How the Savior helped me to Serve others", minutes: 10 },
      { name: "Pres Boot", topic: "Palm Sunday", minutes: 15 },
    ]},

  // ---------------------------- APRIL ------------------------------
  { date: "2026-04-05", conducting: "Boot", special: "GENERAL CONFERENCE" },
  { date: "2026-04-12", conducting: "Boot",
    hymns: { opening: 92, sacrament: 174, intermediate: 287, closing: 135 },
    speakers: [
      { name: "Max Christensen", topic: "Using my agency to strengthen my relationship with Jesus Christ", minutes: 5 },
      { name: "Sis Copeland", topic: "Taking the long view, thinking celestially, helps me build a relationship with Christ", minutes: 10 },
      { name: "Larry Dean", topic: "Looking to Him for solace", minutes: 15 },
    ]},
  { date: "2026-04-19", conducting: "Boot",
    hymns: { opening: 140, sacrament: 194, intermediate: 237, closing: 308 },
    speakers: [
      { name: "Isaac Teel", topic: "Using God's grace", minutes: 5 },
      { name: "Sis Corbin", topic: "Now I am found and lost no more", minutes: 10 },
      { name: "Sis Dean", topic: "The Savior's love guides me in my life", minutes: 15 },
    ]},
  { date: "2026-04-26", conducting: "Boot",
    hymns: { opening: 280, sacrament: 185, intermediate: 73, closing: 157 },
    speakers: [
      { name: "Eli Teel", topic: "Prayer changed our night to day", minutes: 5 },
      { name: "Nathan Cote", topic: "Making weak things become strong, Ether 12", minutes: 10 },
      { name: "Rick Christensen", topic: null, minutes: 15 },
    ]},

  // ---------------------------- MAY --------------------------------
  { date: "2026-05-03", conducting: "Hardin", special: "FAST SUNDAY",
    hymns: { opening: 137, sacrament: 181, intermediate: null, closing: 116 } },
  { date: "2026-05-10", conducting: "Hardin", // TODAY
    hymns: { opening: 294, sacrament: 182, intermediate: "Primary", closing: 304 },
    speakers: [
      { name: "Elder Shatzer", topic: "Being a missionary helps me fulfill God's purpose for me", minutes: 5 },
      { name: "Amber Cote", topic: "The temple; the house of the Lord", minutes: 10 },
      { name: "Sis Hardin", topic: "Where can I turn for peace", minutes: 15 },
    ]},
  { date: "2026-05-17", conducting: "Hardin",
    speakers: [
      { name: "Porter Christensen", topic: "Setting and achieving spiritual goals helps me fulfill God's purpose for me", minutes: 5 },
      { name: "Rachel Fields", topic: "The Come Follow Me program helps me teach my family the gospel", minutes: 10 },
      { name: "Little Phil Copeland", topic: "Live the gospel more fully", minutes: 15 },
    ]},
  { date: "2026-05-24", conducting: "Hardin",
    speakers: [
      { name: "David Copeland", topic: "Why Heavenly Father requires your heart, might, mind and strength", minutes: 5 },
      { name: "Sis Loyd", topic: "Doing service draws me closer to the Savior", minutes: 10 },
      { name: "Christensen, A.", topic: null, minutes: 15 },
    ]},
  { date: "2026-05-31", conducting: "Hardin",
    speakers: [
      { name: "Ella Copeland", topic: "Obedience to God's commandments", minutes: 5 },
      { name: "Ursula Ganato", topic: "Honoring the Sabbath day", minutes: 10 },
      { name: "Sis Lackey", topic: "Why are a broken heart and contrite spirit required to unlock the atonement?", minutes: 15 },
    ]},

  // ---------------------------- JUNE -------------------------------
  { date: "2026-06-07", conducting: "Dean", special: "FAST SUNDAY (President Boot in Locus Fork)" },
  { date: "2026-06-14", conducting: "Dean", special: "Speakers TBD" },
  { date: "2026-06-21", conducting: "Dean",
    speakers: [
      { name: "Kingston Child", topic: "Striving to serve others selflessly", minutes: 5 },
      { name: "Sis Guffrey", topic: "Examples from the scriptures of people who overcame weakness", minutes: 10 },
      { name: "Bro Parker", topic: "Seek and ye shall find", minutes: 15 },
    ]},
  { date: "2026-06-28", conducting: "Dean",
    speakers: [
      { name: "Ben Tippets", topic: "Uniting families for eternity", minutes: 5 },
      { name: "Gene Hutto", topic: "Follow the prophet", minutes: 10 },
      { name: "Phillip Copeland", topic: "Having a perfect brightness of hope", minutes: 15 },
    ]},

  // ---------------------------- JULY -------------------------------
  { date: "2026-07-05", conducting: "Boot", special: "FAST SUNDAY" },
  { date: "2026-07-12", conducting: "Boot",
    speakers: [
      { name: "Danny Tippets", topic: "Paying tithing opens the windows of heaven", minutes: 5 },
      { name: "Sis. Tippets", topic: "Receiving guidance from the scriptures to obtain the purpose of life", minutes: 10 },
      { name: "Brother Mitchell", topic: "The enemy within us", minutes: 15 },
    ]},
  { date: "2026-07-19", conducting: "Boot",
    speakers: [
      { name: "Elder Copeland", topic: "The blessings of having a life anchored in Christ", minutes: 5 },
      { name: "Elder Tippets", topic: "Why does God require that we show gratitude", minutes: 10 },
      { name: "Pedersen", topic: null, minutes: 15 },
    ]},
  { date: "2026-07-26", conducting: "Boot",
    speakers: [
      { name: "James Copeland", topic: "Mercy - a divine gift", minutes: 5 },
      { name: "Elder Boston Childs", topic: "I will go; I will do", minutes: 10 },
      { name: "Elder Keaton Childs", topic: null, minutes: 15 },
    ]},

  // ---------------------------- AUGUST -----------------------------
  { date: "2026-08-02", conducting: "Hardin", special: "FAST SUNDAY" },
  { date: "2026-08-09", conducting: "Hardin",
    speakers: [
      { name: "Charlie Story", topic: "Caring for those in need", minutes: 5 },
      { name: "Sis Malquist", topic: "The Family Proclamation", minutes: 10 },
      { name: "Bro Teel", topic: "Exercising our agency freely is essential to our eternal progression", minutes: 15 },
    ]},
  { date: "2026-08-16", conducting: "Hardin",
    speakers: [
      { name: "Harrison Hardin", topic: "Caring for those in need", minutes: 5 },
      { name: "Bro McWilliams", topic: "The Family Proclamation", minutes: 10 },
      { name: "Williams", topic: null, minutes: 15 },
    ]},
  { date: "2026-08-23", conducting: "Hardin",
    speakers: [
      { name: null, topic: "Increasing our faith in Christ throughout our lives", minutes: 5 },
      { name: "Sis Teel", topic: "The whole armor of God and how can we use it", minutes: 10 },
      { name: "J. Friggle", topic: null, minutes: 15 },
    ]},
  { date: "2026-08-30", conducting: "Hardin",
    speakers: [
      { name: null, topic: "Striving to serve others selflessly", minutes: 5 },
      { name: "Sis Mitchell", topic: "Of you it is required to forgive. Pres. Hinckley, 1980 Oct. Conference", minutes: 10 },
      { name: "Bro Hardin", topic: "Having a perfect brightness of hope", minutes: 15 },
    ]},

  // ---------------------------- SEPTEMBER --------------------------
  { date: "2026-09-06", conducting: "Dean", special: "FAST SUNDAY" },
  { date: "2026-09-13", conducting: "Dean", special: "PRIMARY PROGRAM" },
  { date: "2026-09-20", conducting: "Dean", special: "STAKE CONFERENCE" },
  { date: "2026-09-27", conducting: "Dean", special: "FAST SUNDAY" },

  // ---------------------------- OCTOBER ----------------------------
  { date: "2026-10-04", conducting: "Boot", special: "GENERAL CONFERENCE" },
  { date: "2026-10-11", conducting: "Boot",
    speakers: [
      { name: null, topic: "How forgiveness heals", minutes: 5 },
      { name: "Sis Pitcher", topic: "Why should we show gratitude", minutes: 10 },
      { name: "B. Morrill", topic: null, minutes: 15 },
    ]},
  { date: "2026-10-18", conducting: "Boot",
    speakers: [
      { name: "Dash Christensen", topic: "How can you be a Good Samaritan", minutes: 5 },
      { name: null, topic: "What is truth?", minutes: 10 },
      { name: "R. Huffstutler", topic: null, minutes: 15 },
    ]},
  { date: "2026-10-25", conducting: "Boot",
    speakers: [
      { name: "Max Christensen", topic: "How can we be a good neighbor?", minutes: 5 },
      { name: "Sis Poe", topic: "The principle of work", minutes: 10 },
      { name: "Bro Boot", topic: "When Heavenly Father speaks to me, how do I listen?", minutes: 15 },
    ]},

  // ---------------------------- NOVEMBER ---------------------------
  { date: "2026-11-01", conducting: "Hardin", special: "FAST SUNDAY" },
  { date: "2026-11-08", conducting: "Hardin", special: "Speakers TBD" },
  { date: "2026-11-15", conducting: "Hardin",
    speakers: [
      { name: null, topic: "Mercy - a divine gift", minutes: 5 },
      { name: "Sis Quigley", topic: "I will go; I will do", minutes: 10 },
      { name: "Moore", topic: null, minutes: 15 },
    ]},
  { date: "2026-11-22", conducting: "Hardin",
    speakers: [
      { name: "Eva Christensen", topic: "Being honest in all my dealings", minutes: 5 },
      { name: "Sis Quin", topic: "Judgment, mercy, and faith", minutes: 10 },
      { name: "Sis Blanchard", topic: "The admonition of Paul", minutes: 15 },
    ]},
  { date: "2026-11-29", conducting: "Hardin",
    speakers: [
      { name: "Virginia Teel", topic: "Hope through the Atonement of Jesus Christ", minutes: 5 },
      { name: "Sis Story", topic: "Priesthood blessings for all", minutes: 10 },
      { name: "Bro Hardin", topic: "The doctrine of self-reliance", minutes: 15 },
    ]},

  // ---------------------------- DECEMBER ---------------------------
  { date: "2026-12-06", conducting: "Dean", special: "FAST SUNDAY" },
  { date: "2026-12-13", conducting: "Dean",
    speakers: [
      { name: "Eli Teel", topic: "The title of liberty", minutes: 5 },
      { name: "Sis Wood", topic: "Charity: perfect and everlasting love", minutes: 10 },
      { name: "Bro Childs", topic: "Be an example and a light", minutes: 15 },
    ]},
  { date: "2026-12-20", conducting: "Boot", special: "ONE-HOUR CHRISTMAS PROGRAM" },
  { date: "2026-12-27", conducting: "Dean",
    speakers: [
      { name: "Lorelei Cote", topic: "The many names of Jesus Christ", minutes: 5 },
      { name: "Bro Mitchell", topic: "The power of prayer", minutes: 10 },
      { name: "Bro Dean", topic: "How the goodness and greatness of God helps in your life", minutes: 15 },
    ]},
];

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  // Find the bishop.
  const { data: bishop, error: bishopErr } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "bishopric")
    .eq("bishopric_position", "bishop")
    .single();
  if (bishopErr) throw new Error(`Bishop lookup: ${bishopErr.message}`);
  console.log(`Bishop: ${bishop.full_name} (${bishop.id})`);

  // Load all hymns for title-fallback lookup.
  const { data: hymns } = await supabase.from("hymns").select("id, number, title");
  const hymnByNumber = new Map(hymns.map((h) => [h.number, h.id]));
  const hymnByLowerTitle = new Map(hymns.map((h) => [h.title.toLowerCase(), h.id]));
  function lookupHymn(v) {
    if (v == null) return null;
    if (typeof v === "number") return hymnByNumber.get(v) ?? null;
    // String — try as number first, then title.
    const n = parseInt(v, 10);
    if (!Number.isNaN(n) && hymnByNumber.has(n)) return hymnByNumber.get(n);
    return hymnByLowerTitle.get(v.toLowerCase()) ?? null;
  }

  // Wipe existing programs for the 2026 dates (idempotent re-runs).
  const dates = SCHEDULE.map((p) => p.date);
  const { error: delErr } = await supabase.from("programs").delete().in("meeting_date", dates);
  if (delErr) throw new Error(`Wipe programs: ${delErr.message}`);
  console.log(`Wiped ${dates.length} existing programs (if any).`);

  // Collect unique speakers + topics.
  const speakerNames = new Map(); // name -> { categories: Set<slot> }
  const topicTitles = new Map();  // title -> { dates: [iso] }
  for (const p of SCHEDULE) {
    if (!p.speakers) continue;
    for (let i = 0; i < p.speakers.length; i++) {
      const s = p.speakers[i];
      const slot = ["first", "second", "concluding"][i];
      if (s.name) {
        if (!speakerNames.has(s.name)) speakerNames.set(s.name, { categories: new Set() });
        speakerNames.get(s.name).categories.add(slot);
      }
      if (s.topic) {
        if (!topicTitles.has(s.topic)) topicTitles.set(s.topic, []);
        topicTitles.get(s.topic).push(p.date);
      }
    }
  }
  console.log(`${speakerNames.size} unique speakers, ${topicTitles.size} unique topics.`);

  // Fetch existing speakers/topics to dedupe.
  const { data: existingSpeakers } = await supabase.from("speakers").select("id, full_name");
  const existingSpeakerMap = new Map(existingSpeakers.map((s) => [s.full_name, s.id]));
  const { data: existingTopics } = await supabase.from("topics").select("id, title");
  const existingTopicMap = new Map(existingTopics.map((t) => [t.title, t.id]));

  // Insert new speakers.
  const newSpeakers = [...speakerNames.keys()]
    .filter((n) => !existingSpeakerMap.has(n))
    .map((full_name) => ({ full_name }));
  if (newSpeakers.length) {
    const { data, error } = await supabase.from("speakers").insert(newSpeakers).select("id, full_name");
    if (error) throw new Error(`Insert speakers: ${error.message}`);
    for (const s of data) existingSpeakerMap.set(s.full_name, s.id);
  }

  // Insert speaker_categories rows.
  const catRows = [];
  for (const [name, { categories }] of speakerNames) {
    const id = existingSpeakerMap.get(name);
    for (const cat of categories) catRows.push({ speaker_id: id, category: cat });
  }
  if (catRows.length) {
    // Upsert one-at-a-time so unique conflicts are no-ops.
    await supabase.from("speaker_categories").upsert(catRows, { onConflict: "speaker_id,category" });
  }

  // Insert new topics.
  const newTopics = [...topicTitles.keys()]
    .filter((t) => !existingTopicMap.has(t))
    .map((title) => ({ title }));
  if (newTopics.length) {
    const { data, error } = await supabase.from("topics").insert(newTopics).select("id, title");
    if (error) throw new Error(`Insert topics: ${error.message}`);
    for (const t of data) existingTopicMap.set(t.title, t.id);
  }

  // Insert programs + assignments.
  let created = 0;
  let warnings = [];
  for (const p of SCHEDULE) {
    const isPast = p.date < TODAY;
    const isToday = p.date === TODAY;
    const useConfirmed = isPast || isToday;

    const conductingId = p.conducting === "Boot" ? bishop.id : null;
    const conductingNote = p.conducting !== "Boot" ? `Conducted by ${p.conducting}` : null;
    const brief = [p.special, conductingNote].filter(Boolean).join(" · ") || null;

    const opening = lookupHymn(p.hymns?.opening);
    const sacrament = lookupHymn(p.hymns?.sacrament);
    const closing = lookupHymn(p.hymns?.closing);
    let intermediate = null, intermediateText = null;
    if (typeof p.hymns?.intermediate === "string") {
      const id = lookupHymn(p.hymns.intermediate);
      if (id) intermediate = id;
      else intermediateText = p.hymns.intermediate;
    } else {
      intermediate = lookupHymn(p.hymns?.intermediate);
    }

    const { data: prog, error: progErr } = await supabase
      .from("programs")
      .insert({
        meeting_date: p.date,
        conducting_id: conductingId,
        brief_reminders: brief,
        opening_hymn_id: opening,
        sacrament_hymn_id: sacrament,
        intermediate_hymn_id: intermediate,
        intermediate_hymn_text: intermediateText,
        closing_hymn_id: closing,
        status: useConfirmed ? "published" : "draft",
      })
      .select("id")
      .single();
    if (progErr) {
      warnings.push(`${p.date}: ${progErr.message}`);
      continue;
    }

    if (p.speakers?.length) {
      const rows = p.speakers.map((s, i) => {
        const slot = ["first", "second", "concluding"][i];
        const topicId = s.topic ? existingTopicMap.get(s.topic) : null;
        return {
          program_id: prog.id,
          slot,
          length_minutes: s.minutes,
          speaker_id: s.name ? existingSpeakerMap.get(s.name) : null,
          topic_id: topicId ?? null,
          custom_topic_text: s.topic && !topicId ? s.topic : null,
          status: useConfirmed ? "confirmed" : "not_yet_asked",
        };
      });
      const { error: aErr } = await supabase.from("speaking_assignments").insert(rows);
      if (aErr) warnings.push(`${p.date} assignments: ${aErr.message}`);
    }
    created++;
  }
  console.log(`Created ${created} programs.`);
  if (warnings.length) {
    console.log(`Warnings:\n  ${warnings.join("\n  ")}`);
  }

  // Refresh rotation dates.
  const { error: recErr } = await supabase.rpc("recompute_all_rotation_dates");
  if (recErr) console.log(`Recompute warning: ${recErr.message}`);
  else console.log("Rotation dates refreshed.");

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
