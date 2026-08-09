"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { differenceInDays, format, parseISO, subDays } from "date-fns";
import {
  Save,
  Eye,
  Printer,
  Globe,
  RotateCcw,
  Link2,
  CheckCircle2,
  XCircle,
  Send,
  Mail,
  MessageSquare,
  UserPlus,
  ArrowLeft,
  Sparkles,
  CircleCheck,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { CollapsibleCard } from "@/components/collapsible-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HymnPicker } from "@/components/hymn-picker";
import { SpeakerPicker } from "@/components/speaker-picker";
import { TopicPicker } from "@/components/topic-picker";
import { ConductingPicker } from "@/components/conducting-picker";
import { StatusPill } from "@/components/status-pill";
import { formatMeetingDate } from "@/lib/dates";
import { SLOT_LABELS, SLOT_ORDER, STATUS_HINT } from "@/lib/assignments";
import { unitLabels } from "@/lib/labels";
import type {
  AppSettings,
  AssignmentSlot,
  AssignmentStatus,
  Hymn,
  Profile,
  Program,
  Speaker,
  SpeakingAssignment,
  Topic,
  UserRole,
} from "@/lib/supabase/types";

export type FutureAssignment = {
  assignmentId: string;
  programId: string;
  meetingDate: string;
  slot: AssignmentSlot;
  status: AssignmentStatus;
};
import {
  autoGenerateProgram,
  clearAssignmentSpeaker,
  confirmAssignmentSlot,
  ensureProgramSlots,
  regenerateShareToken,
  resetAssignmentSlot,
  sendAssignmentInvite,
  buildReminderInvite,
  buildEmailInvite,
  setProgramStatus,
  updateAssignmentSpeakerTopic,
  updateAssignmentStatus,
  updateProgramFields,
} from "./actions";

export function ProgramEditor({
  role,
  program,
  assignments,
  speakers,
  topics,
  hymns,
  bishopric,
  settings,
  futureBySpeaker,
}: {
  role: UserRole;
  program: Program;
  assignments: SpeakingAssignment[];
  speakers: Speaker[];
  topics: Topic[];
  hymns: Hymn[];
  bishopric: Profile[];
  settings: AppSettings;
  futureBySpeaker: Record<string, FutureAssignment[]>;
}) {
  const router = useRouter();
  const isBishopric = role === "bishopric";
  const daysUntilMeeting = differenceInDays(
    parseISO(program.meeting_date),
    new Date(),
  );
  const isPast = daysUntilMeeting < 0;
  // Publishing only opens during the meeting's week — the day-6-before through
  // the meeting day. Server action enforces this too.
  const canPublish = daysUntilMeeting <= 6;
  const publishOpensDate = format(
    subDays(parseISO(program.meeting_date), 6),
    "EEE, MMM d",
  );
  const labels = unitLabels(settings.unit_type);
  const [pending, start] = useTransition();
  const [shareOpen, setShareOpen] = useState(false);

  // Local "dirty buffer" for text/hymn fields so we can save in one shot.
  const [draft, setDraft] = useState<Partial<Program>>({
    presiding: program.presiding,
    conducting_id: program.conducting_id,
    welcome_text: program.welcome_text ?? settings.default_welcome_text,
    brief_reminders: program.brief_reminders,
    planner_note: program.planner_note ?? null,
    opening_hymn_id: program.opening_hymn_id,
    sacrament_hymn_id: program.sacrament_hymn_id,
    intermediate_hymn_id: program.intermediate_hymn_id,
    intermediate_hymn_text: program.intermediate_hymn_text,
    closing_hymn_id: program.closing_hymn_id,
    opening_hymn_verse_note: program.opening_hymn_verse_note ?? false,
    sacrament_hymn_verse_note: program.sacrament_hymn_verse_note ?? false,
    intermediate_hymn_verse_note: program.intermediate_hymn_verse_note ?? false,
    closing_hymn_verse_note: program.closing_hymn_verse_note ?? false,
    invocation: program.invocation ?? "By Invitation",
    benediction: program.benediction ?? "By Invitation",
    chorister: program.chorister,
    organist: program.organist,
    releases: program.releases,
    sustainings: program.sustainings,
    move_in_welcomes: program.move_in_welcomes,
    aaronic_sustainings: program.aaronic_sustainings,
    baptism_confirmation: program.baptism_confirmation,
    baby_blessing: program.baby_blessing,
    stake_business: program.stake_business,
    ward_business_releases: program.ward_business_releases,
    ward_business_sustainings: program.ward_business_sustainings,
    ward_business_move_in_welcomes: program.ward_business_move_in_welcomes,
    ward_business_aaronic_sustainings: program.ward_business_aaronic_sustainings,
    ward_business_baptism_confirmation: program.ward_business_baptism_confirmation,
    ward_business_baby_blessing: program.ward_business_baby_blessing,
    meeting_type: program.meeting_type,
    meeting_type_label: program.meeting_type_label,
  });

  const meetingType = draft.meeting_type ?? "regular";
  const isFast = meetingType === "fast_sunday";
  const isNoServices = meetingType === "no_services";

  // Fields a chorister is allowed to update per the DB's
  // guard_chorister_program_update trigger. Everything else the trigger
  // rejects with "Chorister may only edit hymn fields", so a bishopric-
  // shaped draft would fail the whole UPDATE — including the hymn edits
  // the chorister actually changed. Whitelist before sending.
  const CHORISTER_SAVEABLE = new Set<keyof typeof draft>([
    "opening_hymn_id",
    "sacrament_hymn_id",
    "intermediate_hymn_id",
    "closing_hymn_id",
    "opening_hymn_verse_note",
    "sacrament_hymn_verse_note",
    "intermediate_hymn_verse_note",
    "closing_hymn_verse_note",
    "intermediate_hymn_text",
    "chorister",
    "organist",
  ]);

  function saveAll() {
    start(async () => {
      const payload = isBishopric
        ? draft
        : Object.fromEntries(
            Object.entries(draft).filter(([k]) =>
              CHORISTER_SAVEABLE.has(k as keyof typeof draft),
            ),
          );
      const r = await updateProgramFields(program.id, payload);
      if (r.error) toast.error(r.error);
      else toast.success("Saved.");
    });
  }

  /**
   * Persist a single (or handful of) program field(s) immediately without
   * touching anything else in the draft. Used by Ward Business toggles so a
   * tap of "Releases" saves on the spot instead of waiting for the user to
   * find the Save button.
   */
  function saveFields(fields: Partial<Program>) {
    start(async () => {
      const r = await updateProgramFields(program.id, fields);
      if (r.error) toast.error(r.error);
    });
  }

  function copyShareLink(url: string) {
    navigator.clipboard.writeText(url);
    toast.success("Link copied.");
  }

  return (
    <div className="space-y-5 pb-32">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            Sacrament Meeting
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {formatMeetingDate(program.meeting_date)}
          </h1>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span
              className={
                program.status === "published"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-muted-foreground"
              }
            >
              {program.status === "published" ? "Published" : "Draft"}
            </span>
            {program.status === "published" && (
              <>
                <span className="text-muted-foreground">·</span>
                <button
                  onClick={() => setShareOpen(true)}
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  <Link2 className="w-3 h-3" /> Share link
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "default", size: "sm" }))}
            title="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            Done
          </Link>
          <Link
            href={`/programs/${program.id}/view`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "bg-white hover:bg-zinc-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100",
            )}
          >
            <Eye className="w-4 h-4" />
            View
          </Link>
          {isBishopric && (
            <Link
              href={`/programs/${program.id}/papers`}
              target="_blank"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "bg-white hover:bg-zinc-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100",
              )}
            >
              <Printer className="w-4 h-4" />
              Assignments
            </Link>
          )}
        </div>
      </div>

      {/* Meeting type */}
      {isBishopric && (
        <CollapsibleCard
          title="Meeting type"
          defaultOpen={false}
          contentClassName="space-y-3"
        >
            <div className="grid sm:grid-cols-[1fr_240px] gap-3 items-start">
              <Select
                value={meetingType}
                onValueChange={(v) =>
                  setDraft((p) => ({
                    ...p,
                    meeting_type: v as "regular" | "fast_sunday" | "no_services",
                    // Clearing label when switching away from no_services keeps things tidy.
                    meeting_type_label: v === "no_services" ? p.meeting_type_label : null,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {meetingType === "fast_sunday"
                      ? "Fast & Testimony Meeting"
                      : meetingType === "no_services"
                        ? "No sacrament meeting"
                        : "Regular sacrament meeting"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular sacrament meeting</SelectItem>
                  <SelectItem value="fast_sunday">Fast &amp; Testimony Meeting</SelectItem>
                  <SelectItem value="no_services">No sacrament meeting (conference)</SelectItem>
                </SelectContent>
              </Select>
              {isNoServices && (
                <Input
                  placeholder='e.g. "Stake Conference"'
                  value={draft.meeting_type_label ?? ""}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      meeting_type_label: e.target.value || null,
                    }))
                  }
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isFast
                ? "Fast & Testimony: no speakers, no intermediate hymn. Everything else stays the same."
                : isNoServices
                  ? "No sacrament meeting at the unit today. The printed program will show only the banner you typed."
                  : "Regular sacrament meeting with three speakers and an intermediate hymn."}
            </p>
        </CollapsibleCard>
      )}

      {/* Everything except the meeting type itself is hidden on no_services days. */}
      {!isNoServices && (<>

      {/* Header info: presiding / conducting */}
      <CollapsibleCard
        title="Meeting header"
        defaultOpen={false}
        contentClassName="space-y-3"
      >
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Presiding</Label>
              <Input
                disabled={!isBishopric}
                value={draft.presiding ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, presiding: e.target.value || null }))}
                placeholder="e.g. Bishop John Smith"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Conducting</Label>
              {isBishopric ? (
                <ConductingPicker
                  bishopric={bishopric}
                  value={draft.conducting_id ?? null}
                  onChange={(id) => setDraft((p) => ({ ...p, conducting_id: id }))}
                  unitType={settings.unit_type}
                />
              ) : (
                <Input
                  disabled
                  value={bishopric.find((b) => b.id === draft.conducting_id)?.full_name ?? "—"}
                />
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Welcome text</Label>
            <Textarea
              disabled={!isBishopric}
              rows={2}
              value={draft.welcome_text ?? ""}
              onChange={(e) =>
                setDraft((p) => ({ ...p, welcome_text: e.target.value || null }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Brief reminders</Label>
            <Textarea
              disabled={!isBishopric}
              rows={3}
              value={draft.brief_reminders ?? ""}
              onChange={(e) =>
                setDraft((p) => ({ ...p, brief_reminders: e.target.value || null }))
              }
              placeholder="Reminders to read at the pulpit (optional)…"
            />
          </div>
          {isBishopric && (
            <div className="space-y-1.5">
              <Label className="text-red-700 dark:text-red-400">
                Notes (bishopric only)
              </Label>
              <Textarea
                rows={2}
                value={draft.planner_note ?? ""}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, planner_note: e.target.value || null }))
                }
                placeholder="Private note shown in red on the dashboard and the conductor's agenda (e.g. 'Bishop away — Brother X presiding')."
                className="border-red-300 focus-visible:border-red-500 focus-visible:ring-red-500/30"
              />
              <p className="text-[11px] text-muted-foreground">
                Visible on the dashboard and the conductor&rsquo;s agenda.
                Never appears on the public bulletin and never prints.
              </p>
            </div>
          )}
      </CollapsibleCard>

      {/* Hymns */}
      <CollapsibleCard title="Hymns" contentClassName="space-y-3">
          <div className="space-y-1.5">
            <Label>Opening hymn</Label>
            <HymnPicker
              hymns={hymns}
              value={draft.opening_hymn_id ?? null}
              onChange={(id) => setDraft((p) => ({ ...p, opening_hymn_id: id }))}
            />
            <HymnVerseToggle
              hymns={hymns}
              hymnId={draft.opening_hymn_id ?? null}
              checked={!!draft.opening_hymn_verse_note}
              onChange={(v) => {
                setDraft((p) => ({ ...p, opening_hymn_verse_note: v }));
                saveFields({ opening_hymn_verse_note: v });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sacrament hymn</Label>
            <HymnPicker
              hymns={hymns}
              value={draft.sacrament_hymn_id ?? null}
              onChange={(id) => setDraft((p) => ({ ...p, sacrament_hymn_id: id }))}
              slot="sacrament"
            />
            <HymnVerseToggle
              hymns={hymns}
              hymnId={draft.sacrament_hymn_id ?? null}
              checked={!!draft.sacrament_hymn_verse_note}
              onChange={(v) => {
                setDraft((p) => ({ ...p, sacrament_hymn_verse_note: v }));
                saveFields({ sacrament_hymn_verse_note: v });
              }}
            />
          </div>
          {!isFast && (
            <div className="space-y-1.5">
              <Label>Intermediate (hymn or special music)</Label>
              <HymnPicker
                hymns={hymns}
                value={draft.intermediate_hymn_id ?? null}
                onChange={(id) =>
                  setDraft((p) => ({
                    ...p,
                    intermediate_hymn_id: id,
                    intermediate_hymn_text: id ? null : p.intermediate_hymn_text,
                  }))
                }
                placeholder="Pick a hymn, or use the text field below…"
              />
              <HymnVerseToggle
                hymns={hymns}
                hymnId={draft.intermediate_hymn_id ?? null}
                checked={!!draft.intermediate_hymn_verse_note}
                onChange={(v) => {
                  setDraft((p) => ({ ...p, intermediate_hymn_verse_note: v }));
                  saveFields({ intermediate_hymn_verse_note: v });
                }}
              />
              <Input
                disabled={!!draft.intermediate_hymn_id}
                placeholder='e.g. "Primary children" or "Ward choir"'
                value={draft.intermediate_hymn_text ?? ""}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    intermediate_hymn_text: e.target.value || null,
                  }))
                }
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Closing hymn</Label>
            <HymnPicker
              hymns={hymns}
              value={draft.closing_hymn_id ?? null}
              onChange={(id) => setDraft((p) => ({ ...p, closing_hymn_id: id }))}
            />
            <HymnVerseToggle
              hymns={hymns}
              hymnId={draft.closing_hymn_id ?? null}
              checked={!!draft.closing_hymn_verse_note}
              onChange={(v) => {
                setDraft((p) => ({ ...p, closing_hymn_verse_note: v }));
                saveFields({ closing_hymn_verse_note: v });
              }}
            />
          </div>
          {/* Music-team assignments live in the Hymns card so choristers
              can maintain them without needing bishopric permission. */}
          <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t">
            <div className="space-y-1.5">
              <Label>Chorister</Label>
              <Input
                value={draft.chorister ?? ""}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, chorister: e.target.value || null }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Organist</Label>
              <Input
                value={draft.organist ?? ""}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, organist: e.target.value || null }))
                }
              />
            </div>
          </div>
      </CollapsibleCard>

      {/* Ward/Branch business */}
      {isBishopric && (
        <CollapsibleCard
          title={`${labels.unit} business`}
          description={
            <>
              Check the categories that apply this week. Unchecked categories are skipped on
              the printed program. If none are checked, the program prints &quot;There is no{" "}
              {labels.unitLower} business this week.&quot;
            </>
          }
          contentClassName="space-y-3"
        >
            <WardBusinessRow
              label="Releases"
              flagKey="ward_business_releases"
              textKey="releases"
              placeholder="Bro. Smith — Sunday School teacher"
              hint='One per line: "Name — Calling". Prints: "Name has been released as Calling."'
              draft={draft}
              setDraft={setDraft}
              saveFields={saveFields}
            />
            <WardBusinessRow
              label="Sustainings"
              flagKey="ward_business_sustainings"
              textKey="sustainings"
              placeholder="Sis. Jones — Relief Society President"
              hint='One per line: "Name — Calling". Prints: "Name has been called to serve as Calling."'
              draft={draft}
              setDraft={setDraft}
              saveFields={saveFields}
            />
            <WardBusinessRow
              label="New records (move-ins)"
              flagKey="ward_business_move_in_welcomes"
              textKey="move_in_welcomes"
              placeholder="Bro. and Sis. Smith and family"
              hint="One per line. Prints under the standard welcome verbiage."
              draft={draft}
              setDraft={setDraft}
              saveFields={saveFields}
            />
            <WardBusinessRow
              label="Aaronic Priesthood"
              flagKey="ward_business_aaronic_sustainings"
              textKey="aaronic_sustainings"
              placeholder="John Doe — Deacon"
              hint='One per line: "Name — Office". Prints: "We propose that Name receive the Aaronic Priesthood and be ordained a Office."'
              draft={draft}
              setDraft={setDraft}
              saveFields={saveFields}
            />
            <WardBusinessRow
              label="Baptism &amp; Confirmation"
              flagKey="ward_business_baptism_confirmation"
              textKey="baptism_confirmation"
              placeholder="Jane Doe — May 3, 2026"
              hint='One per line: "Name — Date". Prints: "Name was baptized and confirmed a member of the Church on Date and we welcome…"'
              draft={draft}
              setDraft={setDraft}
              saveFields={saveFields}
            />
            <WardBusinessRow
              label="Blessing of a child"
              flagKey="ward_business_baby_blessing"
              textKey="baby_blessing"
              placeholder="Baby Doe — Bro. Doe (father)"
              hint='One per line: "Child name — Person blessing". Prints: "Child name will now be blessed by Person."'
              draft={draft}
              setDraft={setDraft}
              saveFields={saveFields}
            />
            <div className="space-y-1.5 pt-2 border-t">
              <Label>Stake business</Label>
              <Textarea
                rows={2}
                value={draft.stake_business ?? ""}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, stake_business: e.target.value || null }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Stake-level announcements — printed separately from ward business.
              </p>
            </div>
        </CollapsibleCard>
      )}

      {/* Speaking assignments — hidden on fast Sundays (testimony meeting). */}
      {isBishopric && !isFast && (
        <CollapsibleCard
          title="Balance of program"
          contentClassName="space-y-4"
        >
            {assignments.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  This program doesn&apos;t have speaker slots yet (was created as a
                  placeholder).
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    start(async () => {
                      const r = await ensureProgramSlots(program.id);
                      if (r.error) toast.error(r.error);
                      else {
                        toast.success(`Added ${r.created} slot${r.created === 1 ? "" : "s"}.`);
                        router.refresh();
                      }
                    })
                  }
                  disabled={pending}
                >
                  Create speaker slots (5 / 10 / 15 min)
                </Button>
              </div>
            ) : (
              <>
                {!isPast &&
                  !assignments.some(
                    (a) =>
                      a.speaker_id ||
                      a.custom_speaker_name ||
                      a.topic_id ||
                      a.custom_topic_text ||
                      a.slot_confirmed === true,
                  ) && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        start(async () => {
                          const r = await autoGenerateProgram(program.id);
                          if (r.error) toast.error(r.error);
                          else {
                            toast.success(
                              r.filled
                                ? `Filled ${r.filled} slot${r.filled === 1 ? "" : "s"} — review and confirm each.`
                                : "Nothing to fill — all slots already have picks.",
                            );
                            router.refresh();
                          }
                        })
                      }
                      disabled={pending}
                    >
                      <Sparkles className="w-4 h-4" />
                      Auto generate
                    </Button>
                  </div>
                  )}
                {SLOT_ORDER.map((slot) => {
                  const a = assignments.find((x) => x.slot === slot);
                  if (!a) return null;
                  return (
                    <AssignmentCard
                      key={a.id}
                      assignment={a}
                      speakers={speakers}
                      topics={topics}
                      isPast={isPast}
                      pending={pending}
                      start={start}
                      futureBySpeaker={futureBySpeaker}
                      requireApproval={
                        settings.require_speaker_approval ?? false
                      }
                      leaderRole={labels.leaderRole}
                    />
                  );
                })}
              </>
            )}
        </CollapsibleCard>
      )}

      {/* Read-only assignments view for chorister */}
      {!isBishopric && !isFast && (
        <CollapsibleCard
          title="Balance of program"
          contentClassName="space-y-2 text-sm"
        >
            {SLOT_ORDER.map((slot) => {
              const a = assignments.find((x) => x.slot === slot);
              if (!a) return null;
              const speaker = speakers.find((s) => s.id === a.speaker_id);
              const topic = topics.find((t) => t.id === a.topic_id);
              return (
                <div key={a.id} className="flex items-center gap-2 py-1.5 border-b last:border-b-0">
                  <span className="text-muted-foreground w-28 shrink-0">{SLOT_LABELS[slot]}</span>
                  <span className="flex-1">{speaker?.full_name ?? "—"}</span>
                  <span className="text-muted-foreground hidden sm:inline">
                    {topic?.title ?? a.custom_topic_text ?? ""}
                  </span>
                </div>
              );
            })}
        </CollapsibleCard>
      )}

      {/* Day-of fields */}
      {isBishopric && (
        <CollapsibleCard
          title="Sunday-morning fill-in"
          contentClassName="space-y-3"
        >
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Invocation</Label>
                <Input
                  value={draft.invocation ?? ""}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, invocation: e.target.value || null }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Benediction</Label>
                <Input
                  value={draft.benediction ?? ""}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, benediction: e.target.value || null }))
                  }
                />
              </div>
            </div>
        </CollapsibleCard>
      )}
      {/* end of "not no_services" block */}
      </>)}

      {isBishopric && isNoServices && (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              No sacrament meeting
            </div>
            <div className="text-2xl font-semibold tracking-tight">
              {draft.meeting_type_label?.trim() || "Conference"}
            </div>
            <p className="text-sm text-muted-foreground">
              The printed program shows only this banner — no hymns, no speakers, no
              ward business.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sticky save bar — sits above the mobile tab bar (which is z-30, h-16) */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur z-40">
        <div className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center gap-2 justify-center">
          <Button onClick={saveAll} disabled={pending}>
            <Save className="w-4 h-4" /> Save
          </Button>
          {isBishopric && (
            <>
              {program.status === "draft" ? (
                <>
                  {!canPublish && (
                    <span className="text-xs text-muted-foreground">
                      Publishing opens {publishOpensDate}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    onClick={() =>
                      start(async () => {
                        await updateProgramFields(program.id, draft);
                        const r = await setProgramStatus(program.id, "published");
                        if (r.error) toast.error(r.error);
                        else toast.success("Program published.");
                      })
                    }
                    disabled={pending || !canPublish}
                    title={
                      canPublish
                        ? undefined
                        : `Publishing opens ${publishOpensDate} (6 days before the meeting).`
                    }
                  >
                    <Globe className="w-4 h-4" /> Publish
                  </Button>
                </>
              ) : (
                <Link
                  href={`/programs/${program.id}/view`}
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  <Eye className="w-4 h-4" /> View
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* Share link dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Public share links</DialogTitle>
            <DialogDescription>
              Anyone with these links can view the published program. Updates appear instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Always-current link (recommended for Facebook / Circles)
              </div>
              <div className="bg-muted rounded px-3 py-2 text-sm font-mono break-all">
                {typeof window !== "undefined" ? `${location.origin}/p/now` : ""}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Always shows the closest upcoming published program. Share once — it
                auto-advances each week as you publish the next Sunday.
              </p>
              <div className="flex justify-end mt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyShareLink(`${location.origin}/p/now`)}
                >
                  Copy
                </Button>
              </div>
            </div>
            <div className="border-t pt-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Permalink for this specific program
              </div>
              <div className="bg-muted rounded px-3 py-2 text-sm font-mono break-all">
                {typeof window !== "undefined"
                  ? `${location.origin}/p/${program.share_token}`
                  : ""}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Locked to this week&apos;s program even after you publish later Sundays.
                Useful for sharing a specific past meeting.
              </p>
              <div className="flex justify-end gap-2 mt-1">
                {isBishopric && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      start(async () => {
                        const r = await regenerateShareToken(program.id);
                        if (r.error) toast.error(r.error);
                        else toast.success("New permalink generated.");
                      })
                    }
                    disabled={pending}
                  >
                    Regenerate
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() =>
                    copyShareLink(`${location.origin}/p/${program.share_token}`)
                  }
                >
                  Copy
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssignmentCard({
  assignment,
  speakers,
  topics,
  isPast,
  pending,
  start,
  futureBySpeaker,
  requireApproval,
  leaderRole,
}: {
  assignment: SpeakingAssignment;
  speakers: Speaker[];
  topics: Topic[];
  isPast: boolean;
  pending: boolean;
  start: (cb: () => void | Promise<void>) => void;
  futureBySpeaker: Record<string, FutureAssignment[]>;
  requireApproval: boolean;
  leaderRole: string;
}) {
  // The slot_confirmed flag only gates the workflow when the unit has the
  // approval-required setting on. If the setting is off, treat every slot
  // as pre-approved so the invite workflow is immediately available.
  const slotApproved = !requireApproval || assignment.slot_confirmed !== false;
  const locked = assignment.status !== "not_yet_asked";
  const slot = assignment.slot;
  // speaker_id → upcoming meeting dates they're already booked on, so the
  // picker can flag a double-booking before it happens.
  const upcomingBySpeaker = Object.fromEntries(
    Object.entries(futureBySpeaker).map(([id, rows]) => [
      id,
      rows.map((r) => r.meetingDate).sort(),
    ]),
  );
  const [conflict, setConflict] = useState<null | {
    newSpeakerId: string;
    speakerName: string;
    rows: FutureAssignment[];
  }>(null);
  const [stakeOpen, setStakeOpen] = useState(false);
  const [stakeName, setStakeName] = useState(assignment.custom_speaker_name ?? "");
  // When the topic is a typed one-off, offer to also save it to the topic
  // library (tagged with this slot's length) at confirm time.
  const hasOneOffTopic =
    !assignment.topic_id && !!assignment.custom_topic_text?.trim();
  const [promoteTopic, setPromoteTopic] = useState(true);

  function saveSpeakerTopic(next: {
    speaker_id?: string | null;
    custom_speaker_name?: string | null;
    topic_id?: string | null;
    custom_topic_text?: string | null;
  }) {
    // Distinguish "not provided" (undefined → keep current value) from
    // "explicitly cleared" (null → write null). Using `??` collapses both
    // to the existing value, which prevented the X-clear button on each
    // picker from actually clearing the field.
    start(async () => {
      const r = await updateAssignmentSpeakerTopic(assignment.id, {
        speaker_id:
          next.speaker_id === undefined ? assignment.speaker_id : next.speaker_id,
        custom_speaker_name:
          next.custom_speaker_name === undefined
            ? assignment.custom_speaker_name
            : next.custom_speaker_name,
        topic_id:
          next.topic_id === undefined ? assignment.topic_id : next.topic_id,
        custom_topic_text:
          next.custom_topic_text === undefined
            ? assignment.custom_topic_text
            : next.custom_topic_text,
      });
      if (r.error) toast.error(r.error);
    });
  }

  function changeStatus(s: AssignmentStatus) {
    start(async () => {
      const r = await updateAssignmentStatus(assignment.id, s);
      if (r.error) toast.error(r.error);
      else toast.success("Status updated.");
    });
  }

  function resetSlot() {
    start(async () => {
      const r = await resetAssignmentSlot(assignment.id);
      if (r.error) toast.error(r.error);
      else toast.success("Slot reset.");
    });
  }

  // Intercept speaker selection — if the picked person has other future
  // assignments, open the conflict dialog before saving. A stake-speaker change
  // (custom_speaker_name set, speaker_id null) skips the conflict check.
  function handleSpeakerChange(next: {
    speaker_id: string | null;
    custom_speaker_name: string | null;
  }) {
    if (!next.speaker_id) {
      saveSpeakerTopic({
        speaker_id: null,
        custom_speaker_name: next.custom_speaker_name,
      });
      return;
    }
    const future = futureBySpeaker[next.speaker_id] ?? [];
    if (future.length === 0) {
      saveSpeakerTopic({ speaker_id: next.speaker_id, custom_speaker_name: null });
      return;
    }
    const speakerName =
      speakers.find((s) => s.id === next.speaker_id)?.full_name ?? "This speaker";
    setConflict({ newSpeakerId: next.speaker_id, speakerName, rows: future });
  }

  function assignKeepingFuture() {
    if (!conflict) return;
    const name = conflict.speakerName;
    saveSpeakerTopic({
      speaker_id: conflict.newSpeakerId,
      custom_speaker_name: null,
    });
    toast.success(`${name} is now scheduled on both dates.`);
    setConflict(null);
  }

  function assignReplacingFuture() {
    if (!conflict) return;
    const newId = conflict.newSpeakerId;
    const name = conflict.speakerName;
    const rows = conflict.rows;
    start(async () => {
      // Clear them from each future slot — keep topic for not_yet_asked so the
      // rotation can refill that slot, fully reset locked slots.
      let cleared = 0;
      for (const r of rows) {
        const res =
          r.status === "not_yet_asked"
            ? await clearAssignmentSpeaker(r.assignmentId)
            : await resetAssignmentSlot(r.assignmentId);
        if (!res.error) cleared++;
        else toast.error(`${r.meetingDate}: ${res.error}`);
      }
      // Assign to current slot.
      const r2 = await updateAssignmentSpeakerTopic(assignment.id, {
        speaker_id: newId,
        custom_speaker_name: null,
        topic_id: assignment.topic_id,
        custom_topic_text: assignment.custom_topic_text,
      });
      if (r2.error) toast.error(r2.error);
      else
        toast.success(
          `${name} rescheduled here · ${cleared} prior slot${
            cleared === 1 ? "" : "s"
          } returned to the rotation.`,
        );
      setConflict(null);
    });
  }

  return (
    <div className="border rounded-md p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="font-medium">{SLOT_LABELS[slot]}</div>
        <Input
          type="number"
          min={1}
          max={60}
          className="w-20 h-7 text-xs"
          defaultValue={assignment.length_minutes}
          onBlur={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!Number.isNaN(n) && n !== assignment.length_minutes) {
              start(async () => {
                const r = await updateAssignmentSpeakerTopic(assignment.id, {
                  speaker_id: assignment.speaker_id,
                  topic_id: assignment.topic_id,
                  custom_topic_text: assignment.custom_topic_text,
                  length_minutes: n,
                });
                if (r.error) toast.error(r.error);
              });
            }
          }}
        />
        <span className="text-xs text-muted-foreground">min</span>
        <div className="ml-auto flex flex-col items-end gap-0.5">
          <StatusPill status={assignment.status} past={isPast} />
          {!isPast && (
            <span className="text-[10px] leading-none text-muted-foreground">
              {STATUS_HINT[assignment.status]}
            </span>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Speaker</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={locked || isPast}
              onClick={() => setStakeOpen(true)}
            >
              <UserPlus className="w-3 h-3" />
              Stake speaker
            </Button>
          </div>
          <SpeakerPicker
            speakers={speakers}
            category={slot}
            value={assignment.speaker_id}
            customValue={assignment.custom_speaker_name}
            onChange={handleSpeakerChange}
            upcomingBySpeaker={upcomingBySpeaker}
            disabled={isPast}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Topic</Label>
          <TopicPicker
            topics={topics}
            value={assignment.topic_id}
            customValue={assignment.custom_topic_text}
            allowedCategories={
              slot === "first" ? ["first"] : ["second", "concluding"]
            }
            onChange={(next) =>
              saveSpeakerTopic({
                topic_id: next.topic_id,
                custom_topic_text: next.custom_topic_text,
              })
            }
            disabled={isPast}
          />
        </div>
      </div>

      {!isPast && (
        <div className="flex flex-wrap gap-2">
          {/* Draft suggestion: bishop / branch president reviews, then approves
              the pick before the invite workflow opens. Only rendered when
              the unit has the approval workflow turned on in Settings. */}
          {requireApproval &&
            !slotApproved &&
            (assignment.speaker_id || assignment.custom_speaker_name) && (
              <div className="flex flex-col gap-2">
                {hasOneOffTopic && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                    <Checkbox
                      checked={promoteTopic}
                      onCheckedChange={(v) => setPromoteTopic(v === true)}
                    />
                    Also save &ldquo;{assignment.custom_topic_text}&rdquo; as a
                    reusable {SLOT_LABELS[slot]} topic
                  </label>
                )}
                <Button
                  size="sm"
                  className="self-start"
                  onClick={() =>
                    start(async () => {
                      const r = await confirmAssignmentSlot(
                        assignment.id,
                        hasOneOffTopic && promoteTopic,
                      );
                      if (r.error) toast.error(r.error);
                      else toast.success(`${leaderRole}'s approval recorded.`);
                    })
                  }
                  disabled={pending}
                >
                  <CircleCheck className="w-4 h-4" /> {leaderRole}&rsquo;s approval
                </Button>
              </div>
            )}
          {slotApproved &&
            assignment.status === "not_yet_asked" &&
            assignment.speaker_id && (
              <>
                {(() => {
                  const sp = speakers.find(
                    (s) => s.id === assignment.speaker_id,
                  );
                  if (!sp?.phone) return null;
                  return (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          start(async () => {
                            const r = await sendAssignmentInvite(assignment.id);
                            if (r.error) {
                              toast.error(r.error);
                              return;
                            }
                            if (r.smsUrl) window.location.href = r.smsUrl;
                          })
                        }
                        disabled={pending}
                      >
                        <MessageSquare className="w-4 h-4" /> Send text invite
                      </Button>
                      {sp.email && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            start(async () => {
                              const r = await buildEmailInvite(assignment.id);
                              if (r.error) {
                                toast.error(r.error);
                                return;
                              }
                              if (r.mailtoUrl) window.location.href = r.mailtoUrl;
                            })
                          }
                          disabled={pending}
                          title="Email a longer invite that includes the printable-assignment instructions"
                        >
                          <Mail className="w-4 h-4" /> Email invite
                        </Button>
                      )}
                    </>
                  );
                })()}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => changeStatus("awaiting_confirmation")}
                  disabled={pending}
                >
                  <Send className="w-4 h-4" /> Mark as asked
                </Button>
              </>
            )}
          {slotApproved &&
            assignment.status === "awaiting_confirmation" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => changeStatus("confirmed")}
                  disabled={pending}
                >
                  <CheckCircle2 className="w-4 h-4" /> Confirmed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => changeStatus("declined")}
                  disabled={pending}
                >
                  <XCircle className="w-4 h-4" /> Declined
                </Button>
              </>
            )}
          {slotApproved && assignment.status === "confirmed" && (
            <>
              {(() => {
                const sp = speakers.find((s) => s.id === assignment.speaker_id);
                if (!sp?.phone) return null;
                return (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      start(async () => {
                        const r = await buildReminderInvite(assignment.id);
                        if (r.error) {
                          toast.error(r.error);
                          return;
                        }
                        if (r.smsUrl) window.location.href = r.smsUrl;
                      })
                    }
                    disabled={pending}
                    title={
                      assignment.reminded_at
                        ? `Already reminded ${new Date(assignment.reminded_at).toLocaleDateString()}. Tap to send again.`
                        : undefined
                    }
                  >
                    <MessageSquare className="w-4 h-4" />{" "}
                    {assignment.reminded_at ? "Reminded — send again" : "Send reminder"}
                  </Button>
                );
              })()}
              <Button
                size="sm"
                variant="outline"
                onClick={() => changeStatus("declined")}
                disabled={pending}
              >
                <XCircle className="w-4 h-4" /> Mark declined
              </Button>
            </>
          )}
          {(locked ||
            !!assignment.custom_speaker_name ||
            !!assignment.speaker_id) && (
            <Button size="sm" variant="ghost" onClick={resetSlot} disabled={pending}>
              <RotateCcw className="w-4 h-4" /> Reset slot
            </Button>
          )}
          <Link
            href={`/programs/${assignment.program_id}/papers?slot=${slot}`}
            target="_blank"
            className="ml-auto"
          >
            <Button size="sm" variant="ghost">
              <Printer className="w-4 h-4" /> Print assignment
            </Button>
          </Link>
        </div>
      )}

      {assignment.notes && (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1">
          {assignment.notes}
        </div>
      )}
      <Separator />
      <div className="text-[10px] text-muted-foreground flex flex-wrap gap-3">
        {assignment.asked_at && (
          <span>Asked {new Date(assignment.asked_at).toLocaleDateString()}</span>
        )}
        {assignment.confirmed_at && (
          <span>Confirmed {new Date(assignment.confirmed_at).toLocaleDateString()}</span>
        )}
        {assignment.declined_at && (
          <span>Declined {new Date(assignment.declined_at).toLocaleDateString()}</span>
        )}
      </div>
      {assignment.status === "declined" && assignment.decline_reason && (
        <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-2.5 text-xs">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-red-800 dark:text-red-300 mb-0.5">
            Speaker&rsquo;s note
          </div>
          <p className="text-red-900 dark:text-red-200 whitespace-pre-wrap">
            {assignment.decline_reason}
          </p>
        </div>
      )}

      <Dialog open={conflict !== null} onOpenChange={(o) => !o && setConflict(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Reschedule {conflict?.speakerName} or keep both dates?
            </DialogTitle>
            <DialogDescription>
              {conflict?.speakerName} is already on the upcoming schedule.
              Choose whether to add this date in addition to their existing
              assignment, or move them so they only speak on this date.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5 text-sm border rounded-md p-3 bg-muted/40">
            {conflict?.rows.map((r) => (
              <li key={r.assignmentId} className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">
                  {format(parseISO(r.meetingDate), "EEE, MMM d")}
                </span>
                <span className="text-muted-foreground">{SLOT_LABELS[r.slot]}</span>
                <StatusPill status={r.status} className="text-[10px]" />
                <Link
                  href={`/programs/${r.programId}`}
                  target="_blank"
                  className="text-xs underline ml-auto"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
          {conflict?.rows.some((r) => r.status !== "not_yet_asked") && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Note: some of those slots are already past <em>not yet asked</em> — rescheduling
              resets them back to <em>not yet asked</em> so the rotation can refill them
              (the topic stays put).
            </p>
          )}
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button
              variant="ghost"
              onClick={() => setConflict(null)}
              disabled={pending}
              className="sm:mr-auto"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={assignKeepingFuture}
              disabled={pending}
            >
              Keep both dates
            </Button>
            <Button onClick={assignReplacingFuture} disabled={pending}>
              Reschedule to this date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={stakeOpen}
        onOpenChange={(o) => {
          setStakeOpen(o);
          if (o) setStakeName(assignment.custom_speaker_name ?? "");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stake speaker</DialogTitle>
            <DialogDescription>
              Enter the visiting speaker&apos;s name. They&apos;ll appear on this program but
              won&apos;t be saved to the speaker rotation.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={stakeName}
            onChange={(e) => setStakeName(e.target.value)}
            placeholder="e.g. Pres. Anderson (Stake President)"
            autoFocus
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setStakeOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const name = stakeName.trim();
                if (!name) return;
                saveSpeakerTopic({
                  speaker_id: null,
                  custom_speaker_name: name,
                });
                setStakeOpen(false);
              }}
              disabled={pending || !stakeName.trim()}
            >
              Use this name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Opt-in checkbox shown only when the picked hymn carries a verse note.
 * Controls whether "(Verses 1, 3, 5, 6)" prints on this week's program.
 */
function HymnVerseToggle({
  hymns,
  hymnId,
  checked,
  onChange,
}: {
  hymns: Hymn[];
  hymnId: number | null;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const hymn = hymnId ? hymns.find((h) => h.id === hymnId) : null;
  if (!hymn?.verse_note) return null;
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none pt-0.5">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      Print &ldquo;{hymn.verse_note}&rdquo; on the program
    </label>
  );
}

function WardBusinessRow({
  label,
  flagKey,
  textKey,
  placeholder,
  hint,
  draft,
  setDraft,
  saveFields,
}: {
  label: string;
  flagKey: keyof Program;
  textKey: keyof Program;
  placeholder?: string;
  hint?: string;
  draft: Partial<Program>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<Program>>>;
  saveFields: (fields: Partial<Program>) => void;
}) {
  const checked = (draft[flagKey] as boolean | undefined) ?? false;
  const text = (draft[textKey] as string | null | undefined) ?? "";
  const initialTextRef = useRef(text);
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => {
            const next = v === true;
            setDraft((p) => ({ ...p, [flagKey]: next }));
            saveFields({ [flagKey]: next });
          }}
        />
        <span
          className="text-sm font-medium"
          dangerouslySetInnerHTML={{ __html: label }}
        />
      </label>
      {checked && (
        <>
          <Textarea
            rows={2}
            placeholder={placeholder}
            value={text}
            onChange={(e) =>
              setDraft((p) => ({ ...p, [textKey]: e.target.value || null }))
            }
            onBlur={() => {
              if (text !== initialTextRef.current) {
                saveFields({ [textKey]: text || null });
                initialTextRef.current = text;
              }
            }}
          />
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </>
      )}
    </div>
  );
}
