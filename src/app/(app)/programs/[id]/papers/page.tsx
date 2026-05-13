import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssignmentPaper } from "@/components/assignment-paper";
import { PrintStyles } from "@/components/print-styles";
import { PrintTrigger } from "@/components/print-trigger";
import { CloseTabButton } from "@/components/close-tab-button";
import { SLOT_DEFAULT_MINUTES } from "@/lib/assignments";
import type { AssignmentSlot } from "@/lib/supabase/types";

export default async function PapersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  const { id } = await params;
  const { slot: slotFilter } = await searchParams;
  const supabase = await createClient();

  const { data: userRes } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", userRes.user!.id)
    .single();
  if (profile?.role !== "bishopric") redirect("/");

  const { data: program } = await supabase
    .from("programs")
    .select("id, meeting_date")
    .eq("id", id)
    .single();
  if (!program) notFound();

  const { data: settings } = await supabase
    .from("app_settings")
    .select("branch_name, assignment_paper_template")
    .eq("id", 1)
    .single();

  let q = supabase
    .from("speaking_assignments")
    .select(
      `id, slot, length_minutes, custom_topic_text, custom_speaker_name,
       speaker:speakers(full_name),
       topic:topics(title, description)`,
    )
    .eq("program_id", id)
    .order("slot");
  if (slotFilter) q = q.eq("slot", slotFilter as AssignmentSlot);

  const { data: assignments } = await q;

  const papers = (assignments ?? [])
    .map((a) => {
      type Joined = {
        id: string;
        slot: AssignmentSlot;
        length_minutes: number;
        custom_topic_text: string | null;
        custom_speaker_name: string | null;
        speaker: { full_name: string } | { full_name: string }[] | null;
        topic: { title: string; description: string | null } | { title: string; description: string | null }[] | null;
      };
      const row = a as unknown as Joined;
      const speakerObj = Array.isArray(row.speaker) ? row.speaker[0] : row.speaker;
      const topicObj = Array.isArray(row.topic) ? row.topic[0] : row.topic;
      const speakerName = speakerObj?.full_name ?? row.custom_speaker_name ?? null;
      return {
        id: row.id,
        slot: row.slot,
        lengthMinutes: row.length_minutes || SLOT_DEFAULT_MINUTES[row.slot],
        speakerName,
        topicTitle: topicObj?.title ?? row.custom_topic_text ?? "—",
        topicDescription: topicObj?.description ?? null,
      };
    })
    .filter((p) => p.speakerName);

  return (
    <>
      <PrintStyles />
      <div className="bg-zinc-100 dark:bg-zinc-900 min-h-screen py-6">
        <div className="max-w-[8.5in] mx-auto px-4 mb-4 flex items-center justify-between gap-2 no-print">
          <p className="text-sm text-muted-foreground">
            {papers.length} assignment{papers.length === 1 ? "" : "s"} ready.
            Use Cmd/Ctrl+P or the button →
          </p>
          <div className="flex items-center gap-2">
            <CloseTabButton fallbackHref={`/programs/${id}`} />
            <PrintTrigger />
          </div>
        </div>
        <div className="space-y-4">
          {papers.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              No speakers assigned yet.
            </p>
          ) : (
            papers.map((p, i) => (
              <div
                key={p.id}
                className={`bg-white shadow rounded ${i < papers.length - 1 ? "print-page-break" : ""}`}
              >
                <AssignmentPaper
                  branchName={settings?.branch_name ?? "Branch"}
                  meetingDate={program.meeting_date}
                  speakerName={p.speakerName ?? "—"}
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
