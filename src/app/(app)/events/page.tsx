import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { loadActiveUnit } from "@/lib/active-unit";
import type { SacramentEvent } from "@/lib/supabase/types";
import { EventsClient } from "./events-client";

export default async function EventsPage() {
  const ctx = await loadActiveUnit();
  if (!ctx) redirect("/onboarding");
  if (ctx.role !== "leader") redirect("/");

  const supabase = await createClient();

  // Hide events whose event_date is already in the past. Undated events stay
  // visible — they're announcements with just a display window, and the
  // display_end filter handles their cleanup separately.
  const today = format(new Date(), "yyyy-MM-dd");
  const [{ data: events }, { data: settings }] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .eq("unit_id", ctx.unit.id)
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
