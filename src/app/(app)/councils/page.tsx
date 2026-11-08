import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CouncilsList } from "./councils-list";
import type { CouncilMeeting } from "@/lib/supabase/types";

export const metadata = { title: "Councils — Rota" };

export default async function CouncilsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: meetings }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("council_meetings")
      .select("*")
      .order("meeting_date", { ascending: false })
      .limit(100),
  ]);
  if (profile?.role !== "bishopric") redirect("/home");

  return <CouncilsList meetings={(meetings ?? []) as CouncilMeeting[]} />;
}
