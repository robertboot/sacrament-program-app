import { redirect } from "next/navigation";
import { format, addDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { AssignmentPaper } from "@/components/assignment-paper";
import { PrintStyles } from "@/components/print-styles";
import { PrintTrigger } from "@/components/print-trigger";
import { SLOT_DEFAULT_MINUTES } from "@/lib/assignments";
import type { AssignmentSlot } from "@/lib/supabase/types";

type Row = {
  id: string;
  slot: AssignmentSlot;
  length_minutes: number;
  custom_topic_text: string | null;
  custom_speaker_name: string | null;
  speaker: { full_name: string } | { full_name: string }[] | null;
  topic: { title: string; description: string | null } | { title: string; description: string | null }[] | null;
  program: { id: string; meeting_date: string } | { id: string; meeting_date: string }[] | null;
};

export default async function PendingPapersPage() {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", userRes.user!.id)
    .single();
  if (profile?.role !== "bishopric") redirect("/");

  const { data: settings } = await supabase
    .from("app_settings")
    .select("branch_name, assignment_paper_template")
    .eq("id", 1)
    .single();

  const today = format(new Date(), "yyyy-MM-dd");
  const horizon = format(addDays(new Date(), 42), "yyyy-MM-dd"); // 6 weeks

  const { data: rows } = await supabase
    .from("speaking_assignments")
    .select(
      `id, slot, length_minutes, custom_topic_text, custom_speaker_name,
       speaker:speakers(full_name),
       topic:topics(title, description),
       program:programs!inner(id, meeting_date)`,
    )
    .eq("status", "not_yet_asked")
    .or("speaker_id.not.is.null,custom_speaker_name.not.is.null")
    .gte("program.meeting_date", today)
    .lte("program.meeting_date", horizon)
    .returns<Row[]>();

  const papers = (rows ?? [])
    .map((r) => {
      const speaker = Array.isArray(r.speaker) ? r.speaker[0] : r.speaker;
      const topic = Array.isArray(r.topic) ? r.topic[0] : r.topic;
      const program = Array.isArray(r.program) ? r.program[0] : r.program;
      return {
        id: r.id,
        slot: r.slot,
        lengthMinutes: r.length_minutes || SLOT_DEFAULT_MINUTES[r.slot],
        speakerName: speaker?.full_name ?? r.custom_speaker_name ?? "—",
        topicTitle: topic?.title ?? r.custom_topic_text ?? "—",
        topicDescription: topic?.description ?? null,
        meetingDate: program?.meeting_date ?? "",
      };
    })
    .filter((p) => p.meetingDate)
    .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));

  return (
    <>
      <PrintStyles />
      <div className="bg-zinc-100 dark:bg-zinc-900 min-h-screen py-6">
        <div className="max-w-[8.5in] mx-auto px-4 mb-4 flex items-center justify-between no-print">
          <div>
            <h1 className="text-lg font-semibold">Pending assignment papers</h1>
            <p className="text-sm text-muted-foreground">
              {papers.length} paper{papers.length === 1 ? "" : "s"} ready to print, next 6 weeks.
            </p>
          </div>
          {papers.length > 0 && <PrintTrigger label="Print all" />}
        </div>
        <div className="space-y-4">
          {papers.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              Nothing pending — speakers are either unassigned or already asked.
            </p>
          ) : (
            papers.map((p, i) => (
              <div
                key={p.id}
                className={`bg-white shadow rounded ${i < papers.length - 1 ? "print-page-break" : ""}`}
              >
                <AssignmentPaper
                  branchName={settings?.branch_name ?? "Branch"}
                  meetingDate={p.meetingDate}
                  speakerName={p.speakerName}
                  slot={p.slot}
                  lengthMinutes={p.lengthMinutes}
                  topicTitle={p.topicTitle}
                  topicDescription={p.topicDescription}
                  messageTemplate={settings?.assignment_paper_template ?? ""}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
