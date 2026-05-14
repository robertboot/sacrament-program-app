import { redirect } from "next/navigation";
import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { loadActiveUnit } from "@/lib/active-unit";
import type { Speaker, SpeakerCategory } from "@/lib/supabase/types";
import { SpeakersClient } from "./speakers-client";

export default async function SpeakersPage() {
  const ctx = await loadActiveUnit();
  if (!ctx) redirect("/onboarding");
  if (ctx.role !== "leader") redirect("/");

  const supabase = await createClient();

  // Match the planner's visible horizon: today through 91 days out (~3 months).
  // Speakers booked beyond that window aren't flagged "Scheduled" since the
  // bishop can't see those programs on the dashboard yet.
  const today = format(new Date(), "yyyy-MM-dd");
  const horizon = format(addDays(new Date(), 91), "yyyy-MM-dd");

  const [{ data: speakers }, { data: futureRows }, { data: pastRows }] =
    await Promise.all([
      supabase
        .from("speakers")
        .select(`*, speaker_categories(category)`)
        .eq("unit_id", ctx.unit.id)
        .order("full_name"),
      supabase
        .from("speaking_assignments")
        .select("speaker_id, programs!inner(unit_id, meeting_date)")
        .neq("status", "declined")
        .not("speaker_id", "is", null)
        .eq("programs.unit_id", ctx.unit.id)
        .gte("programs.meeting_date", today)
        .lte("programs.meeting_date", horizon),
      // Past assignments (any status except declined) — used to derive
      // each speaker's effective last_spoke_date for the list label and the
      // "Last spoke" sort, because the DB trigger only refreshes
      // speakers.last_spoke_date on confirmed assignments and that's wrong
      // for everyone carried in from before the app existed.
      supabase
        .from("speaking_assignments")
        .select("speaker_id, programs!inner(unit_id, meeting_date)")
        .neq("status", "declined")
        .not("speaker_id", "is", null)
        .eq("programs.unit_id", ctx.unit.id)
        .lt("programs.meeting_date", today),
    ]);

  const scheduledSpeakerIds = new Set<string>(
    (futureRows ?? [])
      .map((r) => (r as { speaker_id: string | null }).speaker_id)
      .filter((id): id is string => !!id),
  );

  // Find the most recent past meeting date per speaker.
  const mostRecentPastBySpeaker = new Map<string, string>();
  type PastRow = {
    speaker_id: string;
    programs: { meeting_date: string } | { meeting_date: string }[] | null;
  };
  for (const r of (pastRows ?? []) as PastRow[]) {
    const p = Array.isArray(r.programs) ? r.programs[0] : r.programs;
    if (!p?.meeting_date) continue;
    const current = mostRecentPastBySpeaker.get(r.speaker_id);
    if (!current || p.meeting_date > current) {
      mostRecentPastBySpeaker.set(r.speaker_id, p.meeting_date);
    }
  }

  const rows: Speaker[] = (speakers ?? []).map((s) => {
    const fromHistory = mostRecentPastBySpeaker.get(s.id) ?? null;
    const effectiveLastSpoke =
      fromHistory && (!s.last_spoke_date || fromHistory > s.last_spoke_date)
        ? fromHistory
        : s.last_spoke_date;
    return {
      ...s,
      categories: (s.speaker_categories ?? []).map(
        (c: { category: SpeakerCategory }) => c.category,
      ),
      scheduled: scheduledSpeakerIds.has(s.id),
      last_spoke_date: effectiveLastSpoke,
    };
  });

  return <SpeakersClient initialSpeakers={rows} />;
}
