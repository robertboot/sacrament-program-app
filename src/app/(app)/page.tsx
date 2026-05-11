import Link from "next/link";
import { addDays, format, parseISO, differenceInDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardStatusPill } from "@/components/dashboard-status-pill";
import { GenerateButton } from "./generate-button";
import { SLOT_LABELS } from "@/lib/assignments";
import type { AssignmentStatus, ProgramStatus, AssignmentSlot } from "@/lib/supabase/types";
import { AlertTriangle, CircleAlert, Clock, RefreshCw } from "lucide-react";

type DashboardRow = {
  id: string;
  meeting_date: string;
  status: ProgramStatus;
  meeting_type: "regular" | "fast_sunday" | "no_services";
  meeting_type_label: string | null;
  conducting: { full_name: string } | null;
  assignments: {
    id: string;
    slot: AssignmentSlot;
    status: AssignmentStatus;
    speaker_id: string | null;
    speaker: { full_name: string } | null;
    custom_speaker_name: string | null;
    topic: { title: string } | null;
    custom_topic_text: string | null;
    asked_at: string | null;
  }[];
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const horizon = format(addDays(new Date(), 91), "yyyy-MM-dd");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user!.id)
    .single();
  const isBishopric = profile?.role === "bishopric";

  const { data: programs } = await supabase
    .from("programs")
    .select(
      `id, meeting_date, status, meeting_type, meeting_type_label,
       conducting:profiles!programs_conducting_id_fkey(full_name),
       assignments:speaking_assignments(id, slot, status, speaker_id, custom_speaker_name, custom_topic_text, asked_at,
         speaker:speakers(full_name),
         topic:topics(title))`,
    )
    .gte("meeting_date", today)
    .lte("meeting_date", horizon)
    .order("meeting_date", { ascending: true })
    .returns<DashboardRow[]>();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Upcoming Sundays</h1>
          <p className="text-sm text-muted-foreground">
            {programs?.length ?? 0} program{programs?.length === 1 ? "" : "s"} in the next 13 weeks.
          </p>
        </div>
        {isBishopric && <GenerateButton />}
      </div>

      {programs && programs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No programs yet.{" "}
            {isBishopric ? (
              <>Tap <strong>Generate</strong> to scaffold the next 3 months of drafts.</>
            ) : (
              <>Ask a bishopric member to generate the schedule.</>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {programs?.map((p) => (
            <DashboardRowCard key={p.id} row={p} canEdit={isBishopric} />
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardRowCard({ row, canEdit }: { row: DashboardRow; canEdit: boolean }) {
  const date = parseISO(row.meeting_date);
  const daysOut = differenceInDays(date, new Date());
  const alerts = buildAlerts(row);

  return (
    <Link href={`/programs/${row.id}/view`}>
      <Card className="hover:bg-accent/30 transition-colors py-0">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <div className="font-medium">{format(date, "EEE, MMM d")}</div>
                <div className="text-xs text-muted-foreground">
                  {daysOut === 0 ? "Today" : `${daysOut} day${daysOut === 1 ? "" : "s"}`}
                </div>
                {row.meeting_type === "fast_sunday" && (
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-700 dark:text-blue-400">
                    Fast Sunday
                  </span>
                )}
                {row.meeting_type === "no_services" && (
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-purple-700 dark:text-purple-400">
                    {row.meeting_type_label ?? "No services"}
                  </span>
                )}
                {row.status === "published" && (
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400">
                    Published
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Conducting: {row.conducting?.full_name ?? "—"}
              </div>
              {row.meeting_type !== "regular" ? (
                <div className="text-xs text-muted-foreground italic mt-2">
                  {row.meeting_type === "fast_sunday"
                    ? "Fast & Testimony Meeting — no speakers."
                    : `${row.meeting_type_label ?? "No services"} — no sacrament meeting.`}
                </div>
              ) : (
              <div className="mt-3 space-y-1.5">
                {(["first", "second", "concluding"] as AssignmentSlot[]).map((slot) => {
                  const a = row.assignments.find((x) => x.slot === slot);
                  if (!a)
                    return (
                      <div key={slot} className="text-sm text-muted-foreground">
                        {SLOT_LABELS[slot]} — <span className="italic">no slot</span>
                      </div>
                    );
                  const isStake = !a.speaker_id && !!a.custom_speaker_name;
                  const topicTitle =
                    a.topic?.title ??
                    a.custom_topic_text ??
                    (isStake ? "Stake Speaker" : null);
                  const speakerName =
                    a.speaker?.full_name ?? a.custom_speaker_name ?? null;
                  return (
                    <div
                      key={slot}
                      className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
                    >
                      <span className="text-muted-foreground w-24 shrink-0">
                        {SLOT_LABELS[slot]}
                      </span>
                      <span className="font-medium">{speakerName ?? "—"}</span>
                      {isStake && (
                        <span className="text-[10px] uppercase tracking-wider text-amber-700">
                          Stake
                        </span>
                      )}
                      {topicTitle && (
                        <span className="text-muted-foreground italic truncate">
                          — {topicTitle}
                        </span>
                      )}
                      <div className="ml-auto">
                        <DashboardStatusPill
                          assignmentId={a.id}
                          status={a.status}
                          past={daysOut < 0}
                          hasSpeaker={!!a.speaker_id || !!a.custom_speaker_name}
                          canEdit={canEdit}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </div>
          {alerts.length > 0 && (
            <div className="mt-3 pt-3 border-t flex flex-wrap gap-1.5">
              {alerts.map((a) => (
                <span
                  key={a.label}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800"
                >
                  <a.Icon className="w-3 h-3" />
                  {a.label}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function buildAlerts(row: DashboardRow) {
  const alerts: { label: string; Icon: typeof CircleAlert }[] = [];
  const daysOut = differenceInDays(parseISO(row.meeting_date), new Date());
  if (daysOut < 0 || daysOut > 42) return alerts; // 6 weeks horizon

  for (const a of row.assignments) {
    if (a.status === "not_yet_asked" && !a.speaker_id) {
      alerts.push({ label: "Needs speaker", Icon: CircleAlert });
    } else if (a.status === "not_yet_asked" && a.speaker_id) {
      alerts.push({ label: "Print & deliver paper", Icon: AlertTriangle });
    } else if (a.status === "awaiting_confirmation" && a.asked_at) {
      const asked = differenceInDays(new Date(), parseISO(a.asked_at));
      if (asked > 7) alerts.push({ label: "Follow up", Icon: Clock });
    } else if (a.status === "declined") {
      alerts.push({ label: "Reassign", Icon: RefreshCw });
    }
  }
  // de-dupe by label
  const seen = new Set<string>();
  return alerts.filter((a) => {
    if (seen.has(a.label)) return false;
    seen.add(a.label);
    return true;
  });
}
