import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type {
  AppSettings,
  AssignmentSlot,
  AssignmentStatus,
  Hymn,
  Profile,
  Program,
  SpeakerCategory,
  SpeakingAssignment,
  Speaker,
  Topic,
} from "@/lib/supabase/types";
import { ProgramEditor, type FutureAssignment } from "./program-editor";

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: userRes } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userRes.user!.id)
    .single();

  const today = format(new Date(), "yyyy-MM-dd");

  const [
    { data: program },
    { data: assignments },
    { data: speakers },
    { data: topics },
    { data: hymns },
    { data: bishopric },
    { data: settings },
    { data: futureRaw },
  ] = await Promise.all([
    supabase.from("programs").select("*").eq("id", id).single(),
    supabase
      .from("speaking_assignments")
      .select("*")
      .eq("program_id", id)
      .order("slot"),
    supabase.from("speakers").select("*, speaker_categories(category)").order("full_name"),
    supabase.from("topics").select("*, topic_categories(category)").order("title"),
    supabase.from("hymns").select("*").order("number"),
    supabase.from("profiles").select("*").eq("role", "bishopric"),
    supabase.from("app_settings").select("*").eq("id", 1).single(),
    supabase
      .from("speaking_assignments")
      .select(`id, speaker_id, slot, status, program:programs!inner(id, meeting_date)`)
      .not("speaker_id", "is", null)
      .neq("status", "declined")
      .neq("program_id", id)
      .gte("program.meeting_date", today),
  ]);

  if (!program) notFound();

  const speakersHydrated: Speaker[] = (speakers ?? []).map((s) => ({
    ...s,
    categories: (s.speaker_categories ?? []).map(
      (c: { category: SpeakerCategory }) => c.category,
    ),
  }));

  const topicsHydrated: Topic[] = (topics ?? []).map((t) => ({
    ...t,
    categories: (t.topic_categories ?? []).map(
      (c: { category: SpeakerCategory }) => c.category,
    ),
  }));

  // Group future assignments by speaker_id for conflict detection in the picker.
  const futureBySpeaker: Record<string, FutureAssignment[]> = {};
  type FutureRow = {
    id: string;
    speaker_id: string;
    slot: AssignmentSlot;
    status: AssignmentStatus;
    program: { id: string; meeting_date: string } | { id: string; meeting_date: string }[];
  };
  for (const row of (futureRaw ?? []) as FutureRow[]) {
    const prog = Array.isArray(row.program) ? row.program[0] : row.program;
    if (!prog) continue;
    if (!futureBySpeaker[row.speaker_id]) futureBySpeaker[row.speaker_id] = [];
    futureBySpeaker[row.speaker_id].push({
      assignmentId: row.id,
      programId: prog.id,
      meetingDate: prog.meeting_date,
      slot: row.slot,
      status: row.status,
    });
  }
  // Sort each speaker's list by date.
  for (const k of Object.keys(futureBySpeaker)) {
    futureBySpeaker[k].sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));
  }

  return (
    <ProgramEditor
      role={profile!.role}
      program={program as Program}
      assignments={(assignments ?? []) as SpeakingAssignment[]}
      speakers={speakersHydrated}
      topics={topicsHydrated}
      hymns={(hymns ?? []) as Hymn[]}
      bishopric={(bishopric ?? []) as Profile[]}
      settings={settings as AppSettings}
      futureBySpeaker={futureBySpeaker}
    />
  );
}
