import Link from "next/link";
import { addDays, addMonths, format, parseISO, differenceInDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardStatusPill } from "@/components/dashboard-status-pill";
import { DashboardInviteAction } from "@/components/dashboard-invite-action";
import { DashboardLegend } from "@/components/dashboard-legend";
import { GenerateButton } from "./generate-button";
import { SLOT_LABELS } from "@/lib/assignments";
import type { AssignmentStatus, ProgramStatus, AssignmentSlot } from "@/lib/supabase/types";
import {
  AlertTriangle,
  CalendarDays as CalendarIcon,
  CheckCircle2,
  CircleAlert,
  Clock,
  Music2,
  Pencil,
  RefreshCw,
  User,
} from "lucide-react";

type Hymn = { number: number; title: string } | null;

type DashboardRow = {
  id: string;
  meeting_date: string;
  status: ProgramStatus;
  meeting_type: "regular" | "fast_sunday" | "no_services";
  meeting_type_label: string | null;
  conducting: { full_name: string } | null;
  opening_hymn_id: string | null;
  sacrament_hymn_id: string | null;
  intermediate_hymn_id: string | null;
  closing_hymn_id: string | null;
  opening_hymn: Hymn;
  sacrament_hymn: Hymn;
  intermediate_hymn: Hymn;
  intermediate_hymn_text: string | null;
  closing_hymn: Hymn;
  assignments: {
    id: string;
    slot: AssignmentSlot;
    status: AssignmentStatus;
    speaker_id: string | null;
    speaker: { full_name: string; phone: string | null } | null;
    custom_speaker_name: string | null;
    topic: { title: string } | null;
    custom_topic_text: string | null;
    asked_at: string | null;
    invited_at: string | null;
    confirmation_source: "self" | "manual" | null;
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
      `id, meeting_date, status, meeting_type, meeting_type_label, intermediate_hymn_text,
       opening_hymn_id, sacrament_hymn_id, intermediate_hymn_id, closing_hymn_id,
       conducting:profiles!programs_conducting_id_fkey(full_name),
       opening_hymn:hymns!programs_opening_hymn_id_fkey(number, title),
       sacrament_hymn:hymns!programs_sacrament_hymn_id_fkey(number, title),
       intermediate_hymn:hymns!programs_intermediate_hymn_id_fkey(number, title),
       closing_hymn:hymns!programs_closing_hymn_id_fkey(number, title),
       assignments:speaking_assignments(id, slot, status, speaker_id, custom_speaker_name, custom_topic_text, asked_at, invited_at, confirmation_source,
         speaker:speakers(full_name, phone),
         topic:topics(title))`,
    )
    .gte("meeting_date", today)
    .lte("meeting_date", horizon)
    .order("meeting_date", { ascending: true })
    .returns<DashboardRow[]>();

  // Absolute latest program date (any future date) so we can lock the Generate
  // button until we're within 3 months of running out of scheduled meetings.
  const { data: lastProgram } = await supabase
    .from("programs")
    .select("meeting_date")
    .order("meeting_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestMeetingDate = lastProgram?.meeting_date ?? null;
  const generateUnlockThreshold = format(addMonths(new Date(), 3), "yyyy-MM-dd");
  const generateUnlockDate =
    latestMeetingDate && latestMeetingDate > generateUnlockThreshold
      ? format(addMonths(parseISO(latestMeetingDate), -3), "yyyy-MM-dd")
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Planner</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upcoming meetings and schedules
        </p>
      </div>

      {isBishopric && (
        <GenerateButton
          unlockDate={generateUnlockDate}
          latestMeetingDate={latestMeetingDate}
        />
      )}

      <DashboardLegend canEdit={isBishopric} />

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
        <>
          {programs && programs[0] && (
            <section className="space-y-3">
              <div className="text-sm uppercase tracking-widest font-bold text-foreground mb-3">
                Upcoming Meetings
              </div>
              <DashboardRowCard row={programs[0]} canEdit={isBishopric} featured />
              <FeaturedAlerts row={programs[0]} />
            </section>
          )}
          {programs && programs.length > 1 && (
            <DashboardGroupedByMonth programs={programs.slice(1)} canEdit={isBishopric} />
          )}
        </>
      )}
    </div>
  );
}

function DashboardGroupedByMonth({
  programs,
  canEdit,
}: {
  programs: DashboardRow[];
  canEdit: boolean;
}) {
  // Group by month so the weeks visually break apart instead of running together.
  const groups: { label: string; rows: DashboardRow[] }[] = [];
  for (const p of programs) {
    const d = parseISO(p.meeting_date);
    const label = format(d, "MMMM yyyy");
    let g = groups[groups.length - 1];
    if (!g || g.label !== label) {
      g = { label, rows: [] };
      groups.push(g);
    }
    g.rows.push(p);
  }
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.label}>
          <div className="sticky top-14 z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b text-xs uppercase tracking-widest font-semibold text-muted-foreground">
            {g.label}
          </div>
          <div className="mt-3 space-y-3">
            {g.rows.map((p) => (
              <DashboardRowCard key={p.id} row={p} canEdit={canEdit} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DashboardRowCard({
  row,
  canEdit,
  featured = false,
}: {
  row: DashboardRow;
  canEdit: boolean;
  featured?: boolean;
}) {
  const date = parseISO(row.meeting_date);
  const daysOut = differenceInDays(date, new Date());
  const alerts = buildAlerts(row);

  return (
    <div className="relative">
      <Link href={`/programs/${row.id}/view`} className="block">
        <Card className="py-0 rounded-2xl shadow-sm ring-1 ring-foreground/10 transition-all hover:bg-accent hover:shadow-md hover:-translate-y-px">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              {row.status === "published" ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 ring-1 ring-emerald-200 dark:ring-emerald-800 rounded-full px-2 py-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Published
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted ring-1 ring-border rounded-full px-2 py-0.5">
                  Draft
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div className="text-xl font-bold tracking-tight">
                {format(date, "EEE, MMM d")}
              </div>
              <div className="text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">
                {daysOut === 0
                  ? "Today"
                  : `in ${daysOut} day${daysOut === 1 ? "" : "s"}`}
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
            </div>
            <div className="text-sm text-muted-foreground mt-2 ml-[3.25rem]">
              Conducting: {row.conducting?.full_name ?? "—"}
            </div>

            {row.meeting_type !== "regular" ? (
              <div className="text-xs text-muted-foreground italic mt-3">
                {row.meeting_type === "fast_sunday"
                  ? "Fast & Testimony Meeting — no speakers."
                  : `${row.meeting_type_label ?? "No services"} — no sacrament meeting.`}
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-muted/40 divide-y divide-border">
                {(["first", "second", "concluding"] as AssignmentSlot[]).map(
                  (slot) => {
                    const a = row.assignments.find((x) => x.slot === slot);
                    if (!a)
                      return (
                        <div
                          key={slot}
                          className="px-3 py-3 text-sm text-muted-foreground"
                        >
                          {SLOT_LABELS[slot]} —{" "}
                          <span className="italic">no slot</span>
                        </div>
                      );
                    const isStake = !a.speaker_id && !!a.custom_speaker_name;
                    const speakerName =
                      a.speaker?.full_name ?? a.custom_speaker_name ?? null;
                    return (
                      <div
                        key={slot}
                        className="flex items-start gap-3 px-3 py-3"
                      >
                        <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-x-2">
                            <span className="text-base font-semibold leading-tight">
                              {speakerName ?? "—"}
                            </span>
                            {isStake && (
                              <span className="text-[10px] uppercase tracking-wider text-amber-700">
                                Stake
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground leading-tight">
                            {SLOT_LABELS[slot]}
                          </div>
                          {canEdit && !isStake && a.speaker_id && speakerName && (
                            <div className="pt-1.5">
                              <DashboardInviteAction
                                assignmentId={a.id}
                                speakerName={speakerName}
                                speakerPhone={a.speaker?.phone ?? null}
                                status={a.status}
                                invitedAt={a.invited_at}
                                confirmationSource={a.confirmation_source}
                              />
                            </div>
                          )}
                        </div>
                        <DashboardStatusPill
                          assignmentId={a.id}
                          status={a.status}
                          past={daysOut < 0}
                          hasSpeaker={
                            !!a.speaker_id || !!a.custom_speaker_name
                          }
                          canEdit={canEdit}
                          dotOnly
                          className="mt-1.5 shrink-0"
                        />
                      </div>
                    );
                  },
                )}
              </div>
            )}

            {featured && row.meeting_type !== "no_services" && (
              <DashboardHymns row={row} />
            )}
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
      {canEdit && (
        <Link
          href={`/programs/${row.id}`}
          aria-label="Edit program"
          className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-md bg-background/95 px-2 py-1 text-xs font-medium text-foreground ring-1 ring-foreground/10 shadow-sm hover:bg-accent hover:text-foreground transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </Link>
      )}
    </div>
  );
}

function FeaturedAlerts({ row }: { row: DashboardRow }) {
  const issues: string[] = [];

  if (row.meeting_type !== "no_services") {
    // Same hymn used in multiple slots.
    const slots: { label: string; id: string | null }[] = [
      { label: "Opening", id: row.opening_hymn_id },
      { label: "Sacrament", id: row.sacrament_hymn_id },
      { label: "Intermediate", id: row.intermediate_hymn_id },
      { label: "Closing", id: row.closing_hymn_id },
    ].filter((s) => s.id) as { label: string; id: string }[];
    const byId = new Map<string, string[]>();
    for (const s of slots) {
      if (!byId.has(s.id!)) byId.set(s.id!, []);
      byId.get(s.id!)!.push(s.label);
    }
    for (const [, labels] of byId) {
      if (labels.length > 1) {
        issues.push(`Same hymn is set for ${labels.join(" and ")}.`);
      }
    }
  }

  if (issues.length === 0) return null;
  return (
    <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 ring-1 ring-red-200 dark:ring-red-900 px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
      <ul className="text-sm font-medium text-red-700 dark:text-red-300 space-y-1">
        {issues.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function DashboardHymns({ row }: { row: DashboardRow }) {
  const intermediateValue =
    row.intermediate_hymn
      ? `#${row.intermediate_hymn.number} — ${row.intermediate_hymn.title}`
      : row.intermediate_hymn_text?.trim() || null;
  const slots: { label: string; value: string | null }[] = [
    {
      label: "Opening",
      value: row.opening_hymn
        ? `#${row.opening_hymn.number} — ${row.opening_hymn.title}`
        : null,
    },
    {
      label: "Sacrament",
      value: row.sacrament_hymn
        ? `#${row.sacrament_hymn.number} — ${row.sacrament_hymn.title}`
        : null,
    },
    { label: "Intermediate", value: intermediateValue },
    {
      label: "Closing",
      value: row.closing_hymn
        ? `#${row.closing_hymn.number} — ${row.closing_hymn.title}`
        : null,
    },
  ];
  return (
    <div className="mt-5 pt-4 border-t space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Music2 className="w-5 h-5 text-[var(--brand-gold)]" />
        <span className="text-lg font-bold tracking-tight">Hymns</span>
      </div>
      {slots.map((s) => (
        <div key={s.label} className="text-sm">
          <div className="text-muted-foreground">{s.label}</div>
          <div
            className={
              s.value
                ? "italic font-medium"
                : "italic text-muted-foreground"
            }
          >
            {s.value ?? "—"}
          </div>
        </div>
      ))}
    </div>
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
