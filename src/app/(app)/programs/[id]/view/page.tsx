import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import { Pencil, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProgramRender, type ProgramRenderData } from "@/components/program-render";
import { PrintStyles } from "@/components/print-styles";
import { PrintTrigger } from "@/components/print-trigger";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function ViewProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: program }, { data: settings }] = await Promise.all([
    supabase
      .from("programs")
      .select(
        `id, meeting_date, presiding, welcome_text, brief_reminders, invocation, benediction,
         releases, sustainings, move_in_welcomes, aaronic_sustainings, baptism_confirmation,
         baby_blessing, stake_business, chorister, organist, status, intermediate_hymn_text,
         meeting_type, meeting_type_label,
         ward_business_releases, ward_business_sustainings, ward_business_move_in_welcomes,
         ward_business_aaronic_sustainings, ward_business_baptism_confirmation,
         ward_business_baby_blessing,
         conducting:profiles!programs_conducting_id_fkey(full_name, bishopric_position),
         opening_hymn:hymns!programs_opening_hymn_id_fkey(number, title),
         sacrament_hymn:hymns!programs_sacrament_hymn_id_fkey(number, title),
         intermediate_hymn:hymns!programs_intermediate_hymn_id_fkey(number, title),
         closing_hymn:hymns!programs_closing_hymn_id_fkey(number, title),
         assignments:speaking_assignments(slot, length_minutes, custom_topic_text, custom_speaker_name,
            speaker:speakers(full_name),
            topic:topics(title))`,
      )
      .eq("id", id)
      .single(),
    supabase
      .from("app_settings")
      .select("branch_name, unit_type")
      .eq("id", 1)
      .single(),
  ]);
  // ward_business_footer column may not exist yet on databases that haven't
  // run the corresponding migration — fetch it defensively so the rest of the
  // page still renders.
  const { data: footerRow } = await supabase
    .from("app_settings")
    .select("ward_business_footer")
    .eq("id", 1)
    .maybeSingle();
  const wardBusinessFooter =
    (footerRow as { ward_business_footer?: string | null } | null)?.ward_business_footer ??
    null;
  if (!program) notFound();

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
    openingHymn: oneOf(program.opening_hymn as unknown as ProgramRenderData["openingHymn"] | ProgramRenderData["openingHymn"][]),
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
    sacramentHymn: oneOf(program.sacrament_hymn as unknown as ProgramRenderData["sacramentHymn"] | ProgramRenderData["sacramentHymn"][]),
    intermediateHymn: oneOf(program.intermediate_hymn as unknown as ProgramRenderData["intermediateHymn"] | ProgramRenderData["intermediateHymn"][]),
    intermediateHymnText: program.intermediate_hymn_text,
    closingHymn: oneOf(program.closing_hymn as unknown as ProgramRenderData["closingHymn"] | ProgramRenderData["closingHymn"][]),
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
          <div className="flex items-center justify-between gap-2 mb-3">
            <h1 className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
              Program Preview
            </h1>
            <Badge variant="outline">
              {program.status === "published" ? "Published" : "Draft"}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Link
              href={`/programs/${id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Pencil className="w-4 h-4" />
              Edit
            </Link>
            <PrintTrigger variant="outline" size="sm" />
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "default", size: "sm" }))}
              title="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              Done
            </Link>
          </div>
        </div>
        <div className="bg-white shadow rounded">
          <ProgramRender data={data} />
        </div>
      </div>
    </>
  );
}
