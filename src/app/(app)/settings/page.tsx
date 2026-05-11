import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppSettings, Profile } from "@/lib/supabase/types";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user!.id)
    .single();
  if (profile?.role !== "bishopric") redirect("/");

  const [{ data: settings }, { data: profiles }] = await Promise.all([
    supabase.from("app_settings").select("*").eq("id", 1).single(),
    supabase.from("profiles").select("*").order("full_name"),
  ]);

  return (
    <SettingsClient
      settings={settings as AppSettings}
      profiles={(profiles ?? []) as Profile[]}
    />
  );
}
