import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { loadActiveUnit } from "@/lib/active-unit";
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
  const ctx = await loadActiveUnit();
  if (!ctx) redirect("/onboarding");

  const supabase = await createClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const [
    { data: program },
    { data: assignments },
    { data: speakers },
    { data: topics },
    { data: hymns },
    { data: leaderRows },
    { data: futureRaw },
    { data: pastForLastSpoke },
  ] = await Promise.all([
    supabase.from("programs").select("*").eq("id", id).eq("unit_id", ctx.unit.id).single(),
    supabase
      .from("speaking_assignments")
      .select("*")
      .eq("program_id", id)
      .order("slot"),
    supabase.from("speakers").select("*, speaker_categories(category)").eq("unit_id", ctx.unit.id).order("full_name"),
    supabase.from("topics").select("*, topic_categories(category)").eq("unit_id", ctx.unit.id).order("title"),
    supabase.from("hymns").select("*").order("number"),
    // Leaders for the conducting picker — unit_members joined to profiles.
    supabase
      .from("unit_members")
      .select("user_id, position, last_conducted_date, profiles(full_name, email)")
      .eq("unit_id", ctx.unit.id)
      .eq("role", "leader"),
    supabase
      .from("speaking_assignments")
      .select(`id, speaker_id, slot, status, program:programs!inner(id, unit_id, meeting_date)`)
      .not("speaker_id", "is", null)
      .neq("status", "declined")
      .neq("program_id", id)
      .eq("program.unit_id", ctx.unit.id)
      .gte("program.meeting_date", today),
    // Past assignments (any status except declined) used to derive each
    // speaker's effective last_spoke_date so the picker's rotation order
    // is correct even when old assignments were never flipped to confirmed.
    supabase
      .from("speaking_assignments")
      .select(`speaker_id, programs!inner(unit_id, meeting_date)`)
      .not("speaker_id", "is", null)
      .neq("status", "declined")
      .eq("programs.unit_id", ctx.unit.id)
      .lt("programs.meeting_date", today),
  ]);

  if (!program) notFound();

  type PastForLast = {
    speaker_id: string;
    programs: { meeting_date: string } | { meeting_date: string }[] | null;
  };
  const mostRecentPastBySpeaker = new Map<string, string>();
  for (const r of (pastForLastSpoke ?? []) as PastForLast[]) {
    const p = Array.isArray(r.programs) ? r.programs[0] : r.programs;
    if (!p?.meeting_date) continue;
    const current = mostRecentPastBySpeaker.get(r.speaker_id);
    if (!current || p.meeting_date > current) {
      mostRecentPastBySpeaker.set(r.speaker_id, p.meeting_date);
    }
  }

  const speakersHydrated: Speaker[] = (speakers ?? []).map((s) => {
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
      last_spoke_date: effectiveLastSpoke,
    };
  });

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

  // Adapt unit_members + profiles join into the v1 Profile[] shape the
  // existing ProgramEditor expects. (We'll port the editor to use the new
  // ConductorOption[] directly in a follow-up.)
  type LeaderRow = {
    user_id: string;
    position: import("@/lib/supabase/types").LeaderPosition | null;
    last_conducted_date: string | null;
    profiles: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
  };
  const bishopric: Profile[] = ((leaderRows ?? []) as LeaderRow[]).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      id: m.user_id,
      full_name: p?.full_name ?? "",
      email: p?.email ?? "",
      active_unit_id: null,
      created_at: "",
      role: "leader",
      bishopric_position: m.position,
      last_conducted_date: m.last_conducted_date,
    } as Profile;
  });

  // Build a v1-style AppSettings shim from the unit so the existing editor
  // keeps working without a deeper port.
  const settings: AppSettings = {
    ...ctx.unit,
    branch_name: ctx.unit.name,
    unit_type: ctx.unit.type,
    ward_business_footer: ctx.unit.unit_business_footer,
  };

  return (
    <ProgramEditor
      role={ctx.role === "leader" ? "bishopric" : "chorister"}
      program={program as Program}
      assignments={(assignments ?? []) as SpeakingAssignment[]}
      speakers={speakersHydrated}
      topics={topicsHydrated}
      hymns={(hymns ?? []) as Hymn[]}
      bishopric={bishopric}
      settings={settings}
      futureBySpeaker={futureBySpeaker}
    />
  );
}
