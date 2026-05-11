import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SpeakerCategory, Topic } from "@/lib/supabase/types";
import { TopicsClient } from "./topics-client";

export default async function TopicsPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user!.id)
    .single();
  if (profile?.role !== "bishopric") redirect("/");

  const { data: topics } = await supabase
    .from("topics")
    .select("*, topic_categories(category)")
    .order("title");

  const rows: Topic[] = (topics ?? []).map((t) => ({
    ...t,
    categories: (t.topic_categories ?? []).map(
      (c: { category: SpeakerCategory }) => c.category,
    ),
  }));

  return <TopicsClient initialTopics={rows} />;
}
