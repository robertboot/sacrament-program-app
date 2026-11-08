import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CouncilEditor } from "./council-editor";
import type {
  CouncilAgendaItem,
  CouncilMeeting,
  Hymn,
} from "@/lib/supabase/types";

export const metadata = { title: "Council agenda — Rota" };

export default async function CouncilEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: meeting },
    { data: items },
    { data: hymns },
    { data: settings },
  ] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("council_meetings").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("council_agenda_items")
      .select("*")
      .eq("meeting_id", id)
      .order("position"),
    supabase
      .from("hymns")
      .select("id, number, title, hymnal, usage_tags, verse_note")
      .order("number"),
    supabase
      .from("app_settings")
      .select("branch_name")
      .eq("id", 1)
      .maybeSingle(),
  ]);
  if (profile?.role !== "bishopric") redirect("/home");
  if (!meeting) notFound();

  const branchName =
    (settings as { branch_name: string | null } | null)?.branch_name ??
    "Talladega";

  return (
    <CouncilEditor
      branchName={branchName}
      meeting={meeting as CouncilMeeting}
      items={(items ?? []) as CouncilAgendaItem[]}
      hymns={(hymns ?? []) as Hymn[]}
    />
  );
}
