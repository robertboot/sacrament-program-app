/**
 * Weekly cron: every Monday evening, drop a bell notification for the
 * bishopric summarizing the status of this Sunday's speakers so they
 * can send reminders (or chase silent invites) with the week still
 * plenty of runway.
 *
 * Timezone: Vercel crons run in UTC. `0 0 * * 2` = Tuesday 00:00 UTC
 * = Monday 6:00 PM Mountain Daylight Time (5:00 PM MST in winter) —
 * close enough to "Monday evening at 6" for a US-Mountain audience
 * year-round. Adjust the cron entry in vercel.json if you'd like a
 * different local time.
 *
 * Fires ONE notification per program (grouped), not per assignment.
 * Body includes a compact tally like "2 confirmed · 1 pending · 0
 * declined" so a leader can read the situation off the bell without
 * having to open the app.
 *
 * Manual trigger for testing:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://your-domain/api/cron/weekly-status
 */

import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyBishopric } from "@/lib/notifications";

export const dynamic = "force-dynamic";

type Row = {
  program_id: string;
  status: "not_yet_asked" | "awaiting_confirmation" | "confirmed" | "declined";
  program: { meeting_date: string } | { meeting_date: string }[] | null;
};

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createServiceClient();

  // "This Sunday" from Monday evening = 6 days out. Widen slightly to
  // catch Fri/Sat/Sun meetings in the same week in case a unit ever
  // moves its meeting day.
  const today = new Date();
  const from = format(today, "yyyy-MM-dd");
  const to = format(addDays(today, 7), "yyyy-MM-dd");

  const { data, error } = await sb
    .from("speaking_assignments")
    .select(`program_id, status, program:programs!inner(meeting_date)`)
    .in("status", ["not_yet_asked", "awaiting_confirmation", "confirmed", "declined"])
    .gte("program.meeting_date", from)
    .lte("program.meeting_date", to);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as Row[];

  // Group by program → status tally.
  type Tally = {
    program_id: string;
    meeting_date: string;
    confirmed: number;
    awaiting: number;
    declined: number;
    notAsked: number;
  };
  const byProgram = new Map<string, Tally>();
  for (const r of rows) {
    const prog = Array.isArray(r.program) ? r.program[0] : r.program;
    if (!prog) continue;
    let t = byProgram.get(r.program_id);
    if (!t) {
      t = {
        program_id: r.program_id,
        meeting_date: prog.meeting_date,
        confirmed: 0,
        awaiting: 0,
        declined: 0,
        notAsked: 0,
      };
      byProgram.set(r.program_id, t);
    }
    if (r.status === "confirmed") t.confirmed += 1;
    else if (r.status === "awaiting_confirmation") t.awaiting += 1;
    else if (r.status === "declined") t.declined += 1;
    else t.notAsked += 1;
  }

  let sent = 0;
  for (const t of byProgram.values()) {
    const meetingLabel = new Date(t.meeting_date + "T00:00:00").toLocaleDateString(
      "en-US",
      { weekday: "long", month: "long", day: "numeric" },
    );
    const parts: string[] = [];
    if (t.confirmed) parts.push(`${t.confirmed} confirmed`);
    if (t.awaiting) parts.push(`${t.awaiting} awaiting reply`);
    if (t.notAsked) parts.push(`${t.notAsked} not yet asked`);
    if (t.declined) parts.push(`${t.declined} declined`);
    const summary = parts.length ? parts.join(" · ") : "No speakers scheduled yet";

    await notifyBishopric({
      type: "speaker_reminder_due",
      title: `${meetingLabel} — speaker status`,
      body: `${summary}. Tap to send reminders or chase silent invites.`,
      actionUrl: `/programs/${t.program_id}`,
    });
    sent += 1;
  }

  return NextResponse.json({
    window: { from, to },
    programs: byProgram.size,
    notifications_sent: sent,
  });
}
