import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Speaker, SpeakerCategory } from "@/lib/supabase/types";
import { SpeakersClient } from "./speakers-client";

export default async function SpeakersPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user!.id)
    .single();
  if (profile?.role !== "bishopric") redirect("/");

  const { data: speakers } = await supabase
    .from("speakers")
    .select(`*, speaker_categories(category)`)
    .order("full_name");

  const rows: Speaker[] = (speakers ?? []).map((s) => ({
    ...s,
    categories: (s.speaker_categories ?? []).map(
      (c: { category: SpeakerCategory }) => c.category,
    ),
  }));

  return <SpeakersClient initialSpeakers={rows} />;
}
