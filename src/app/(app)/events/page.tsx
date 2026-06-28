import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type { SacramentEvent } from "@/lib/supabase/types";
import { EventsClient } from "./events-client";

export default async function EventsPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user!.id)
    .single();
  if (profile?.role !== "bishopric") redirect("/");

  // Hide events whose event_date is already in the past. Undated events stay
  // visible — they're announcements with just a display window, and the
  // display_end filter handles their cleanup separately.
  const today = format(new Date(), "yyyy-MM-dd");
  const [{ data: events }, { data: settings }] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .or(`event_date.is.null,event_date.gte.${today}`)
      .order("event_date", { ascending: true, nullsFirst: false })
      .returns<SacramentEvent[]>(),
    supabase.from("app_settings").select("calendar_ics_url").eq("id", 1).maybeSingle(),
  ]);

  return (
    <EventsClient
      initialEvents={events ?? []}
      initialCalendarUrl={
        (settings as { calendar_ics_url: string | null } | null)?.calendar_ics_url ?? null
      }
    />
  );
}
