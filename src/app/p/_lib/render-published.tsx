import { notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ProgramRender, type ProgramRenderData } from "@/components/program-render";
import { PrintStyles } from "@/components/print-styles";
import { PublicViewToolbar } from "@/components/public-view-toolbar";
import { format, parseISO } from "date-fns";

type PayloadAssignment = {
  slot: ProgramRenderData["assignments"][number]["slot"];
  length_minutes: number;
  speaker_name: string | null;
  is_stake_speaker: boolean | null;
  topic_title: string | null;
  topic_description: string | null;
};

type Payload = {
  id: string;
  meeting_date: string;
  presiding: string | null;
  welcome_text: string | null;
  brief_reminders: string | null;
  invocation: string | null;
  benediction: string | null;
  chorister: string | null;
  organist: string | null;
  releases: string | null;
  sustainings: string | null;
  move_in_welcomes: string | null;
  aaronic_sustainings: string | null;
  baptism_confirmation: string | null;
  baby_blessing: string | null;
  stake_business: string | null;
  ward_business_releases: boolean | null;
  ward_business_sustainings: boolean | null;
  ward_business_move_in_welcomes: boolean | null;
  ward_business_aaronic_sustainings: boolean | null;
  ward_business_baptism_confirmation: boolean | null;
  ward_business_baby_blessing: boolean | null;
  intermediate_hymn_text: string | null;
  meeting_type: "regular" | "fast_sunday" | "no_services" | null;
  meeting_type_label: string | null;
  conducting: { full_name: string; bishopric_position: string | null } | null;
  opening_hymn: { number: number; title: string } | null;
  sacrament_hymn: { number: number; title: string } | null;
  intermediate_hymn: { number: number; title: string } | null;
  closing_hymn: { number: number; title: string } | null;
  assignments: PayloadAssignment[] | null;
  events: { title: string; description: string | null; event_date: string | null }[];
  brief_reminder_events: {
    title: string;
    description: string | null;
    event_date: string | null;
  }[];
  settings:
    | {
        branch_name: string;
        unit_type?: "ward" | "branch";
        ward_business_footer?: string | null;
      }
    | null;
};

export async function renderPublishedProgramByToken(token: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("get_published_program", { p_token: token });
  if (error || !data) notFound();

  // The RPC hasn't been extended to return the manual hymn text columns
  // (opening/sacrament/closing) yet, so grab them via a small side query
  // by the same share_token. Defensive — if the migration isn't applied
  // yet or the query fails, we quietly fall back to nulls and hymn-id
  // lookups render as before.
  const { data: manualHymnRow } = await supabase
    .from("programs")
    .select("opening_hymn_text, sacrament_hymn_text, closing_hymn_text")
    .eq("share_token", token)
    .maybeSingle();
  const manualHymnText = (manualHymnRow ?? {}) as {
    opening_hymn_text?: string | null;
    sacrament_hymn_text?: string | null;
    closing_hymn_text?: string | null;
  };

  // If a signed-in bishopric/chorister is viewing this public link, offer a
  // one-tap toggle back to the conductor view of the same program.
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  const payload = data as Payload;
  const conductorHref = user ? `/programs/${payload.id}/view` : null;

  return renderPayload(payload, conductorHref, manualHymnText);
}

function renderPayload(
  p: Payload,
  conductorHref: string | null,
  manualHymnText: {
    opening_hymn_text?: string | null;
    sacrament_hymn_text?: string | null;
    closing_hymn_text?: string | null;
  } = {},
) {
  const renderData: ProgramRenderData = {
    branchName: p.settings?.branch_name ?? "Branch",
    unitType: p.settings?.unit_type ?? "branch",
    meetingType: p.meeting_type ?? "regular",
    meetingTypeLabel: p.meeting_type_label ?? null,
    wardBusinessFooter: p.settings?.ward_business_footer ?? null,
    meetingDate: p.meeting_date,
    presiding: p.presiding,
    conducting: p.conducting,
    welcomeText: p.welcome_text,
    briefReminders: p.brief_reminders,
    openingHymn: p.opening_hymn,
    openingHymnText: manualHymnText.opening_hymn_text ?? null,
    invocation: p.invocation,
    wardBusiness: {
      releases: { active: !!p.ward_business_releases, names: p.releases },
      sustainings: { active: !!p.ward_business_sustainings, names: p.sustainings },
      moveInWelcomes: {
        active: !!p.ward_business_move_in_welcomes,
        names: p.move_in_welcomes,
      },
      aaronicSustainings: {
        active: !!p.ward_business_aaronic_sustainings,
        names: p.aaronic_sustainings,
      },
      baptismConfirmation: {
        active: !!p.ward_business_baptism_confirmation,
        names: p.baptism_confirmation,
      },
      babyBlessing: {
        active: !!p.ward_business_baby_blessing,
        names: p.baby_blessing,
      },
    },
    stakeBusiness: p.stake_business,
    sacramentHymn: p.sacrament_hymn,
    sacramentHymnText: manualHymnText.sacrament_hymn_text ?? null,
    intermediateHymn: p.intermediate_hymn,
    intermediateHymnText: p.intermediate_hymn_text,
    closingHymn: p.closing_hymn,
    closingHymnText: manualHymnText.closing_hymn_text ?? null,
    benediction: p.benediction,
    chorister: p.chorister,
    organist: p.organist,
    assignments: (p.assignments ?? []).map((a) => ({
      slot: a.slot,
      speakerName: a.speaker_name,
      topicTitle: a.topic_title,
      isStake: !!a.is_stake_speaker,
      lengthMinutes: a.length_minutes,
    })),
    events: p.events ?? [],
    briefReminderEvents: p.brief_reminder_events ?? [],
  };

  const shareTitle = `${renderData.branchName} — ${format(parseISO(renderData.meetingDate), "MMM d, yyyy")} sacrament meeting`;

  return (
    <>
      <PrintStyles />
      <div className="bg-zinc-100 dark:bg-zinc-900 min-h-screen py-6">
        <PublicViewToolbar title={shareTitle} conductorHref={conductorHref} />
        <div className="bg-white shadow rounded max-w-[7.5in] mx-auto">
          <ProgramRender data={renderData} mode="public" />
        </div>
      </div>
    </>
  );
}
