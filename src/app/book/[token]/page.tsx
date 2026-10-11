import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { BookForm } from "./book-form";
import {
  BOOKING_HORIZON_WEEKS,
  candidateDates,
  isInTithingSeason,
} from "@/lib/meeting-slots";
import type { MeetingBlock, MeetingBooking } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function BookPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const sb = createServiceClient();

  const { data: settings } = await sb
    .from("app_settings")
    .select(
      "booking_token, calendar_enabled, tithing_declarations_enabled, branch_name, unit_type",
    )
    .eq("id", 1)
    .single();
  const s =
    (settings as {
      booking_token: string | null;
      calendar_enabled: boolean | null;
      tithing_declarations_enabled: boolean | null;
      branch_name: string | null;
      unit_type: "ward" | "branch" | null;
    } | null) ?? null;

  if (!s?.booking_token || s.booking_token !== token) notFound();

  if (!s.calendar_enabled) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-10 flex items-start justify-center">
        <div className="w-full max-w-md space-y-4 bg-white dark:bg-zinc-900 border rounded-xl p-6 shadow-sm text-center">
          <h1 className="text-xl font-semibold">Scheduling isn&rsquo;t open right now</h1>
          <p className="text-sm text-muted-foreground">
            Please reach out to the {s.unit_type === "ward" ? "bishop" : "branch president"} directly.
          </p>
        </div>
      </main>
    );
  }

  // Fetch everything the client needs to render available dates + slots.
  const horizonStart = new Date();
  horizonStart.setHours(0, 0, 0, 0);
  const horizonEnd = new Date(horizonStart);
  horizonEnd.setDate(horizonEnd.getDate() + BOOKING_HORIZON_WEEKS * 7);

  const [{ data: blocks }, { data: bookings }, { data: noServicesPrograms }] =
    await Promise.all([
      sb.from("meeting_blocks").select("*"),
      sb
        .from("meeting_bookings")
        .select("start_at, end_at")
        .eq("status", "confirmed")
        .gte("start_at", horizonStart.toISOString())
        .lte("start_at", horizonEnd.toISOString()),
      sb
        .from("programs")
        .select("meeting_date")
        .eq("meeting_type", "no_services")
        .gte("meeting_date", horizonStart.toISOString().slice(0, 10))
        .lte("meeting_date", horizonEnd.toISOString().slice(0, 10)),
    ]);

  const blockedDates = new Set<string>(
    ((noServicesPrograms ?? []) as { meeting_date: string }[]).map(
      (p) => p.meeting_date,
    ),
  );

  const dates = candidateDates(horizonStart, blockedDates);
  const tithingAllowed =
    !!s.tithing_declarations_enabled && isInTithingSeason(horizonStart);

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-10 flex items-start justify-center">
      <div className="w-full max-w-md space-y-6 bg-white dark:bg-zinc-900 border rounded-xl p-6 shadow-sm">
        <div className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
          {s.branch_name ?? "Sacrament meeting"}
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Schedule a meeting
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a type, pick a time that works for you, and we&rsquo;ll
            confirm on this page.
          </p>
        </div>
        <BookForm
          token={token}
          availableDates={dates}
          tithingAllowed={tithingAllowed}
          blocks={(blocks ?? []) as MeetingBlock[]}
          bookings={
            (bookings ?? []) as Pick<MeetingBooking, "start_at" | "end_at">[]
          }
        />
      </div>
    </main>
  );
}
