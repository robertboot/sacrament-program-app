// Merge duplicate topics. Strategy per duplicate group (case/whitespace-insensitive title):
//   - keep the OLDEST row as canonical (most likely already referenced)
//   - if canonical has empty description but a dupe has one, copy it over
//   - mark canonical active if any of the dupes is active
//   - union topic_categories onto canonical
//   - repoint speaking_assignments.topic_id from dupe -> canonical
//   - delete dupe topic_categories then dupe topic
//
// Usage:
//   node scripts/dedupe-topics.mjs           # dry run, shows what would change
//   node scripts/dedupe-topics.mjs --apply   # actually do it

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const apply = process.argv.includes("--apply");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: topics, error: e1 } = await sb
  .from("topics")
  .select("id, title, description, is_active, created_at")
  .order("created_at", { ascending: true });
if (e1) throw e1;

const { data: cats, error: e2 } = await sb
  .from("topic_categories")
  .select("topic_id, category");
if (e2) throw e2;

const catByTopic = new Map();
for (const c of cats) {
  if (!catByTopic.has(c.topic_id)) catByTopic.set(c.topic_id, new Set());
  catByTopic.get(c.topic_id).add(c.category);
}

const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
const groups = new Map();
for (const t of topics) {
  const key = norm(t.title);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(t);
}

const dupGroups = [...groups.values()].filter((arr) => arr.length > 1);
console.log(
  `\n${apply ? "APPLYING" : "DRY RUN"} — ${dupGroups.length} duplicate groups, ${dupGroups.reduce((n, g) => n + g.length - 1, 0)} extra rows to remove\n`,
);

let totalRepointed = 0;
let totalCatsMerged = 0;
let totalDeleted = 0;

for (const group of dupGroups) {
  // Oldest first because we already sorted ascending.
  const [canonical, ...dupes] = group;
  const dupIds = dupes.map((d) => d.id);

  // Union categories.
  const canonicalCats = catByTopic.get(canonical.id) ?? new Set();
  const mergedCats = new Set(canonicalCats);
  for (const d of dupes) {
    for (const c of catByTopic.get(d.id) ?? []) mergedCats.add(c);
  }
  const newCats = [...mergedCats].filter((c) => !canonicalCats.has(c));

  // Pick a description if canonical lacks one.
  const desc =
    canonical.description?.trim() ||
    dupes.find((d) => d.description?.trim())?.description ||
    null;

  // Active if any are active.
  const active = canonical.is_active || dupes.some((d) => d.is_active);

  // Count assignments referencing dupes (just for the dry-run summary).
  const { count: refCount, error: ce } = await sb
    .from("speaking_assignments")
    .select("id", { count: "exact", head: true })
    .in("topic_id", dupIds);
  if (ce) throw ce;

  console.log(
    `"${canonical.title}" — keep ${canonical.id.slice(0, 8)}, remove ${dupes.length} dupe(s), repoint ${refCount ?? 0} assignment(s), add ${newCats.length} new category(s)`,
  );

  if (!apply) continue;

  // 1. Repoint speaking_assignments.
  if (refCount && refCount > 0) {
    const { error: ue } = await sb
      .from("speaking_assignments")
      .update({ topic_id: canonical.id })
      .in("topic_id", dupIds);
    if (ue) throw ue;
    totalRepointed += refCount;
  }

  // 2. Update canonical (desc + active) if changed.
  const needsUpdate =
    (desc ?? null) !== (canonical.description ?? null) ||
    active !== canonical.is_active;
  if (needsUpdate) {
    const { error: ue } = await sb
      .from("topics")
      .update({ description: desc, is_active: active })
      .eq("id", canonical.id);
    if (ue) throw ue;
  }

  // 3. Insert any new categories onto canonical.
  if (newCats.length) {
    const { error: ie } = await sb
      .from("topic_categories")
      .insert(newCats.map((c) => ({ topic_id: canonical.id, category: c })));
    if (ie) throw ie;
    totalCatsMerged += newCats.length;
  }

  // 4. Delete dupe topic_categories.
  const { error: dce } = await sb
    .from("topic_categories")
    .delete()
    .in("topic_id", dupIds);
  if (dce) throw dce;

  // 5. Delete dupe topics.
  const { error: dte } = await sb.from("topics").delete().in("id", dupIds);
  if (dte) throw dte;
  totalDeleted += dupes.length;
}

console.log(
  `\nDone. ${apply ? `Repointed ${totalRepointed} assignments, merged ${totalCatsMerged} categories, deleted ${totalDeleted} duplicate topics.` : "Re-run with --apply to perform the merge."}`,
);
