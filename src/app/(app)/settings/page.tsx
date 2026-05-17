import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { AppSettings, Hymn, Profile } from "@/lib/supabase/types";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user!.id)
    .single();
  if (profile?.role !== "bishopric") redirect("/");

  const [{ data: settings }, { data: profiles }, { data: hymns }] =
    await Promise.all([
      supabase.from("app_settings").select("*").eq("id", 1).single(),
      supabase.from("profiles").select("*").order("full_name"),
      supabase
        .from("hymns")
        .select("id, number, title, hymnal, usage_tags, verse_note")
        .order("number"),
    ]);

  // Hydrate each profile's email from auth.users via the service client so
  // the settings UI can show + edit emails. Placeholder addresses ending in
  // .placeholder.invalid are surfaced as null so the UI can offer "Add email
  // to invite" rather than the bogus generated string.
  const admin = createServiceClient();
  const emailsById = new Map<string, string | null>();
  try {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
    for (const u of list?.users ?? []) {
      const real = u.email && !u.email.endsWith(".placeholder.invalid")
        ? u.email
        : null;
      emailsById.set(u.id, real);
    }
  } catch {
    // listUsers permission can fail in dev; fall back to no emails.
  }

  const hydrated: Profile[] = (profiles ?? []).map((p) => ({
    ...p,
    email: emailsById.get(p.id) ?? null,
  }));

  return (
    <SettingsClient
      settings={settings as AppSettings}
      profiles={hydrated}
      hymns={(hymns ?? []) as Hymn[]}
    />
  );
}
