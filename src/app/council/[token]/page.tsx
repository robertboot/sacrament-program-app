import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { CouncilRender } from "@/components/council-render";
import { CouncilPrintStyles } from "@/components/council-print-styles";
import { ShareHeader } from "./share-header";
import type {
  CouncilAgendaItem,
  CouncilMeeting,
  Hymn,
} from "@/lib/supabase/types";

export const metadata = {
  title: "Council agenda",
  robots: { index: false, follow: false },
};

// The share URL is anon-accessible (same model as /p/<token> for the
// sacrament bulletin). We use the service client because there's no
// anon RLS policy on council_meetings — the token itself is the gate.
export default async function PublicCouncilPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const sb = createServiceClient();

  const { data: meeting } = await sb
    .from("council_meetings")
    .select("*")
    .eq("share_token", token)
    .maybeSingle();
  if (!meeting) notFound();

  const m = meeting as CouncilMeeting;
  const [{ data: items }, { data: settings }, { data: hymn }] = await Promise.all([
    sb
      .from("council_agenda_items")
      .select("*")
      .eq("meeting_id", m.id)
      .order("position"),
    sb
      .from("app_settings")
      .select("branch_name")
      .eq("id", 1)
      .maybeSingle(),
    m.opening_hymn_id
      ? sb
          .from("hymns")
          .select("id, number, title, hymnal, usage_tags, verse_note")
          .eq("id", m.opening_hymn_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const branchName =
    (settings as { branch_name: string | null } | null)?.branch_name ??
    "Talladega";

  return (
    <>
      <CouncilPrintStyles kind={m.kind} />
      <ShareHeader kindLabel={m.kind === "branch_council" ? "Branch Council" : "BYC"} />
      <CouncilRender
        branchName={branchName}
        meeting={m}
        items={(items ?? []) as CouncilAgendaItem[]}
        hymn={(hymn as Hymn | null) ?? null}
      />
    </>
  );
}
