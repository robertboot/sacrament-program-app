import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, format, parseISO, subDays } from "date-fns";
import { Pencil, ArrowLeft, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProgramRender, type ProgramRenderData } from "@/components/program-render";
import { PrintStyles } from "@/components/print-styles";
import { PrintTrigger } from "@/components/print-trigger";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PublishButton } from "./publish-button";

export default async function ViewProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // getClaims verifies the JWT locally without an auth round-trip. The
  // profile lookup + program + settings queries all run in a single
  // parallel batch; previously getUser() + profile + a second app_settings
  // query + a second programs query + a hymns verse_note query all ran
  // serially after the main pair, adding 5 sequential round-trips.
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  const [
    { data: program },
    { data: settings },
    { data: viewerProfile },
  ] = await Promise.all([
    supabase
      .from("programs")
      .select(
        `id, meeting_date, presiding, welcome_text, brief_reminders, invocation, benediction,
         releases, sustainings, move_in_welcomes, aaronic_sustainings, baptism_confirmation,
         baby_blessing, stake_business, chorister, organist, status, share_token, intermediate_hymn_text,
         meeting_type, meeting_type_label, planner_note,
         opening_hymn_id, sacrament_hymn_id, intermediate_hymn_id, closing_hymn_id,
         opening_hymn_verse_note, sacrament_hymn_verse_note, intermediate_hymn_verse_note, closing_hymn_verse_note,
         ward_business_releases, ward_business_sustainings, ward_business_move_in_welcomes,
         ward_business_aaronic_sustainings, ward_business_baptism_confirmation,
         ward_business_baby_blessing,
         conducting:profiles!programs_conducting_id_fkey(full_name, bishopric_position),
         opening_hymn:hymns!programs_opening_hymn_id_fkey(number, title, verse_note),
         sacrament_hymn:hymns!programs_sacrament_hymn_id_fkey(number, title, verse_note),
         intermediate_hymn:hymns!programs_intermediate_hymn_id_fkey(number, title, verse_note),
         closing_hymn:hymns!programs_closing_hymn_id_fkey(number, title, verse_note),
         assignments:speaking_assignments(slot, length_minutes, custom_topic_text, custom_speaker_name,
            speaker:speakers(full_name),
            topic:topics(title))`,
      )
      .eq("id", id)
      .single(),
    supabase
      .from("app_settings")
      .select("branch_name, unit_type, ward_business_footer")
      .eq("id", 1)
      .single(),
    // Bishopric-only affordances (Publish/Unpublish). Regular members and
    // choristers see the toolbar without the publish controls.
    userId
      ? supabase.from("profiles").select("role").eq("id", userId).maybeSingle()
      : Promise.resolve({ data: null as { role: string } | null }),
  ]);
  if (!program) notFound();
  const wardBusinessFooter =
    (settings as { ward_business_footer?: string | null } | null)?.ward_business_footer ??
    null;
  const isBishopric = viewerProfile?.role === "bishopric";

  const meetingDate = parseISO(program.meeting_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilMeeting = Math.round(
    (meetingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  const canPublish = daysUntilMeeting <= 6;
  const publishOpensDate = format(subDays(meetingDate, 6), "EEE, MMM d");

  const verseFlags = {
    opening_hymn_verse_note: (program as { opening_hymn_verse_note?: boolean }).opening_hymn_verse_note,
    sacrament_hymn_verse_note: (program as { sacrament_hymn_verse_note?: boolean }).sacrament_hymn_verse_note,
    intermediate_hymn_verse_note: (program as { intermediate_hymn_verse_note?: boolean }).intermediate_hymn_verse_note,
    closing_hymn_verse_note: (program as { closing_hymn_verse_note?: boolean }).closing_hymn_verse_note,
  };
  // Hymn verse_note now travels on each hymn join above; the standalone
  // hymns lookup is gone. Downstream withVerse() reads verse notes via a
  // Map<hymnId, verse_note>, so rebuild that from the joined rows.
  const verseNoteById = new Map<number, string | null>();
  for (const [hid, raw] of [
    [program.opening_hymn_id, program.opening_hymn],
    [program.sacrament_hymn_id, program.sacrament_hymn],
    [program.intermediate_hymn_id, program.intermediate_hymn],
    [program.closing_hymn_id, program.closing_hymn],
  ] as const) {
    if (hid == null || !raw) continue;
    const h = Array.isArray(raw) ? raw[0] : raw;
    verseNoteById.set(hid as number, (h as { verse_note?: string | null }).verse_note ?? null);
  }

  // Only print events whose event_date is within 6 weeks of this meeting
  // (undated events still print as long as the display window matches).
  const eventHorizon = format(addDays(parseISO(program.meeting_date), 42), "yyyy-MM-dd");
  // Brief-reminder events get a tighter 32-day window from this program's date
  // so the upcoming list stays focused on what's actually coming up soon.
  const briefHorizon = format(addDays(parseISO(program.meeting_date), 32), "yyyy-MM-dd");
  const [{ data: events }, { data: briefReminderEvents }] = await Promise.all([
    supabase
      .from("events")
      .select("title, description, event_date")
      .eq("as_brief_reminder", false)
      .lte("display_start", program.meeting_date)
      .gte("display_end", program.meeting_date)
      .or(`event_date.is.null,event_date.lte.${eventHorizon}`)
      .order("event_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("events")
      .select("title, description, event_date")
      .eq("as_brief_reminder", true)
      .gte("event_date", program.meeting_date)
      .lte("event_date", briefHorizon)
      .order("event_date", { ascending: true }),
  ]);

  // Supabase types relations as arrays even for single FKs — unwrap them.
  const oneOf = <T,>(v: T | T[] | null | undefined): T | null => {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
  };

  // Append the verse note to the hymn title when the bishop opted in for
  // that slot, so the conductor view matches the public bulletin. The note
  // comes from the defensive verseNoteById lookup (empty pre-migration).
  const withVerse = (
    raw: unknown,
    hymnId: number | null,
    showNote: boolean | null | undefined,
  ): { number: number; title: string } | null => {
    const h = oneOf(
      raw as
        | { number: number; title: string }
        | { number: number; title: string }[]
        | null,
    );
    if (!h) return null;
    const note = hymnId != null ? verseNoteById.get(hymnId) : null;
    return {
      number: h.number,
      title: showNote && note ? `${h.title} (${note})` : h.title,
    };
  };

  const data: ProgramRenderData = {
    branchName: settings?.branch_name ?? "Branch",
    unitType: (settings?.unit_type as "ward" | "branch") ?? "branch",
    meetingType: (program.meeting_type as "regular" | "fast_sunday" | "no_services") ?? "regular",
    meetingTypeLabel: program.meeting_type_label ?? null,
    wardBusinessFooter: wardBusinessFooter,
    meetingDate: program.meeting_date,
    presiding: program.presiding,
    conducting: oneOf(program.conducting as unknown as ProgramRenderData["conducting"] | ProgramRenderData["conducting"][]),
    welcomeText: program.welcome_text,
    briefReminders: program.brief_reminders,
    openingHymn: withVerse(program.opening_hymn, program.opening_hymn_id, verseFlags.opening_hymn_verse_note),
    invocation: program.invocation,
    wardBusiness: {
      releases: { active: !!program.ward_business_releases, names: program.releases },
      sustainings: { active: !!program.ward_business_sustainings, names: program.sustainings },
      moveInWelcomes: {
        active: !!program.ward_business_move_in_welcomes,
        names: program.move_in_welcomes,
      },
      aaronicSustainings: {
        active: !!program.ward_business_aaronic_sustainings,
        names: program.aaronic_sustainings,
      },
      baptismConfirmation: {
        active: !!program.ward_business_baptism_confirmation,
        names: program.baptism_confirmation,
      },
      babyBlessing: {
        active: !!program.ward_business_baby_blessing,
        names: program.baby_blessing,
      },
    },
    stakeBusiness: program.stake_business,
    sacramentHymn: withVerse(program.sacrament_hymn, program.sacrament_hymn_id, verseFlags.sacrament_hymn_verse_note),
    intermediateHymn: withVerse(program.intermediate_hymn, program.intermediate_hymn_id, verseFlags.intermediate_hymn_verse_note),
    intermediateHymnText: program.intermediate_hymn_text,
    closingHymn: withVerse(program.closing_hymn, program.closing_hymn_id, verseFlags.closing_hymn_verse_note),
    benediction: program.benediction,
    chorister: program.chorister,
    organist: program.organist,
    assignments: ((program.assignments ?? []) as unknown as {
      slot: ProgramRenderData["assignments"][number]["slot"];
      length_minutes: number;
      custom_topic_text: string | null;
      custom_speaker_name: string | null;
      speaker: { full_name: string } | { full_name: string }[] | null;
      topic: { title: string } | { title: string }[] | null;
    }[]).map((a) => {
      const speaker = Array.isArray(a.speaker) ? a.speaker[0] : a.speaker;
      const topic = Array.isArray(a.topic) ? a.topic[0] : a.topic;
      return {
        slot: a.slot,
        speakerName: speaker?.full_name ?? a.custom_speaker_name ?? null,
        topicTitle: topic?.title ?? a.custom_topic_text ?? null,
        isStake: !speaker && !!a.custom_speaker_name,
        lengthMinutes: a.length_minutes,
      };
    }),
    events: events ?? [],
    briefReminderEvents: briefReminderEvents ?? [],
  };

  return (
    <>
      <PrintStyles />
      <div className="bg-zinc-100 dark:bg-zinc-900 min-h-screen py-6">
        <div className="max-w-[7.5in] mx-auto px-4 mb-4 no-print">
          <div className="mb-3">
            <h1 className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
              Conductor&rsquo;s Program
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Detailed version — visible only to signed-in leaders
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "default", size: "sm" }))}
              title="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              Close
            </Link>
            {isBishopric && (
              <PublishButton
                programId={program.id}
                status={program.status as "draft" | "published"}
                canPublish={canPublish}
                publishOpensDate={publishOpensDate}
              />
            )}
            <Link
              href={`/programs/${id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Pencil className="w-4 h-4" />
              Edit
            </Link>
            {program.status === "published" && program.share_token && (
              <Link
                href={`/p/${program.share_token}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                title="See the congregation-facing bulletin"
              >
                <Globe className="w-4 h-4" />
                Public view
              </Link>
            )}
            <PrintTrigger variant="outline" size="sm" />
          </div>
          {isBishopric && (
            <div className="mt-3">
              {program.status === "published" ? (
                <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                  Published - this Sundays program is live
                </div>
              ) : (
                <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-3 py-2 text-sm text-red-800 dark:text-red-200">
                  Not-Published - Sundays program needs to be published still.
                  {!canPublish && (
                    <>
                      {" "}
                      Publishing opens {publishOpensDate} (6 days before the
                      meeting).
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {program.planner_note && (
          <div className="max-w-[7.5in] mx-auto px-4 mb-4 no-print">
            <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-3 py-2 text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap">
              <div className="text-[11px] uppercase tracking-wider font-semibold mb-1">
                Notes
              </div>
              {program.planner_note}
            </div>
          </div>
        )}
        <div className="bg-white shadow rounded">
          <ProgramRender data={data} />
        </div>
      </div>
    </>
  );
}
