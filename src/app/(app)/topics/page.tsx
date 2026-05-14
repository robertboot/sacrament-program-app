import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadActiveUnit } from "@/lib/active-unit";
import type { SpeakerCategory, Topic } from "@/lib/supabase/types";
import { TopicsClient } from "./topics-client";

export default async function TopicsPage() {
  const ctx = await loadActiveUnit();
  if (!ctx) redirect("/onboarding");
  if (ctx.role !== "leader") redirect("/");

  const supabase = await createClient();
  const { data: topics } = await supabase
    .from("topics")
    .select("*, topic_categories(category)")
    .eq("unit_id", ctx.unit.id)
    .order("title");

  const rows: Topic[] = (topics ?? []).map((t) => ({
    ...t,
    categories: (t.topic_categories ?? []).map(
      (c: { category: SpeakerCategory }) => c.category,
    ),
  }));

  return <TopicsClient initialTopics={rows} />;
}
