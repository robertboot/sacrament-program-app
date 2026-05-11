import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

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

const { data: topics, error } = await sb
  .from("topics")
  .select("id, title, description, is_active, created_at")
  .order("title", { ascending: true });

if (error) {
  console.error(error);
  process.exit(1);
}

const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
const groups = new Map();
for (const t of topics) {
  const key = norm(t.title);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(t);
}

const dups = [...groups.entries()].filter(([, arr]) => arr.length > 1);

console.log(`\nTotal topics: ${topics.length}`);
console.log(`Duplicate titles (case/whitespace-insensitive): ${dups.length}\n`);

for (const [key, arr] of dups) {
  console.log(`"${arr[0].title}" (${arr.length} copies):`);
  for (const t of arr) {
    console.log(
      `  - ${t.id} | active=${t.is_active} | "${t.description ?? ""}" | created ${t.created_at}`,
    );
  }
  console.log();
}
