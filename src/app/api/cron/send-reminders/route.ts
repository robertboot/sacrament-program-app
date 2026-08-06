/**
 * Daily cron: for every program with confirmed speakers meeting in 2 days,
 * fire a single in-app notification prompting the bishopric to send
 * reminder texts. Each leader taps into the program and uses the per-
 * speaker "Send reminder" button, which opens their native Messages app.
 *
 * This used to send Twilio SMS directly; we switched to native SMS so
 * leaders send from their own number (recognizable to the speaker, no
 * Twilio cost). The cron still runs so nobody forgets to send reminders.
 *
 * Idempotent: at most one "send reminders" notification per program is
 * emitted, keyed off the program id in the action_url. If the cron runs
 * twice on the same day, the second run inserts a duplicate row — the
 * bell handles duplicates gracefully but if that becomes noisy we can
 * add a reminder_notified_at column later.
 *
 * Manual trigger for testing:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://your-domain/api/cron/send-reminders
 */

import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyBishopric } from "@/lib/notifications";

export const dynamic = "force-dynamic";

type Row = {
  program_id: string;
  meeting_date: string;
  confirmed_count: number;
};

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetDate = format(addDays(new Date(), 2), "yyyy-MM-dd");
  const sb = createServiceClient();

  const { data, error } = await sb
    .from("speaking_assignments")
    .select(`program_id, program:programs!inner(meeting_date)`)
    .eq("status", "confirmed")
    .eq("program.meeting_date", targetDate);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as {
    program_id: string;
    program: { meeting_date: string } | { meeting_date: string }[] | null;
  }[];

  // Group by program so we fire one notification per meeting, not one per
  // speaker. The action_url deep-links leaders to the program editor
  // where each confirmed speaker has a Send-reminder button.
  const byProgram = new Map<string, Row>();
  for (const r of rows) {
    const prog = Array.isArray(r.program) ? r.program[0] : r.program;
    if (!prog) continue;
    const existing = byProgram.get(r.program_id);
    if (existing) {
      existing.confirmed_count += 1;
    } else {
      byProgram.set(r.program_id, {
        program_id: r.program_id,
        meeting_date: prog.meeting_date,
        confirmed_count: 1,
      });
    }
  }

  let sent = 0;
  for (const p of byProgram.values()) {
    const meetingLabel = new Date(p.meeting_date + "T00:00:00").toLocaleDateString(
      "en-US",
      { weekday: "long", month: "long", day: "numeric" },
    );
    await notifyBishopric({
      type: "speaker_reminder_due",
      title: `Time to remind Sunday's speakers — ${meetingLabel}`,
      body: `${p.confirmed_count} confirmed speaker${p.confirmed_count === 1 ? "" : "s"}. Open the program to send each one a reminder text.`,
      actionUrl: `/programs/${p.program_id}`,
    });
    sent += 1;
  }

  return NextResponse.json({
    target_date: targetDate,
    programs_with_reminders: byProgram.size,
    notifications_sent: sent,
  });
}
