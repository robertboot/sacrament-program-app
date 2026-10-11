import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarClient } from "./calendar-client";
import type { MeetingBlock, MeetingBooking } from "@/lib/supabase/types";

export const metadata = { title: "Calendar — Rota" };

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: settings }, { data: bookings }, { data: blocks }] =
    await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase
        .from("app_settings")
        .select(
          "calendar_enabled, tithing_declarations_enabled, booking_token, branch_name, unit_type",
        )
        .eq("id", 1)
        .single(),
      supabase
        .from("meeting_bookings")
        .select("*")
        .eq("status", "confirmed")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(100),
      supabase
        .from("meeting_blocks")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);
  if (profile?.role !== "bishopric") redirect("/home");

  const s =
    (settings as {
      calendar_enabled: boolean | null;
      tithing_declarations_enabled: boolean | null;
      booking_token: string | null;
      branch_name: string | null;
      unit_type: "ward" | "branch" | null;
    } | null) ?? null;

  return (
    <CalendarClient
      calendarEnabled={!!s?.calendar_enabled}
      tithingEnabled={!!s?.tithing_declarations_enabled}
      bookingToken={s?.booking_token ?? null}
      upcomingBookings={(bookings ?? []) as MeetingBooking[]}
      blocks={(blocks ?? []) as MeetingBlock[]}
    />
  );
}
