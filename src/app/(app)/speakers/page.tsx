import { redirect } from "next/navigation";
import { format } from "date-fns";
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

  const today = format(new Date(), "yyyy-MM-dd");

  const [{ data: speakers }, { data: futureRows }] = await Promise.all([
    supabase
      .from("speakers")
      .select(`*, speaker_categories(category)`)
      .order("full_name"),
    supabase
      .from("speaking_assignments")
      .select("speaker_id, programs!inner(meeting_date)")
      .neq("status", "declined")
      .not("speaker_id", "is", null)
      .gte("programs.meeting_date", today),
  ]);

  const scheduledSpeakerIds = new Set<string>(
    (futureRows ?? [])
      .map((r) => (r as { speaker_id: string | null }).speaker_id)
      .filter((id): id is string => !!id),
  );

  const rows: Speaker[] = (speakers ?? []).map((s) => ({
    ...s,
    categories: (s.speaker_categories ?? []).map(
      (c: { category: SpeakerCategory }) => c.category,
    ),
    scheduled: scheduledSpeakerIds.has(s.id),
  }));

  return <SpeakersClient initialSpeakers={rows} />;
}
