/**
 * Daily cron: for each speaking assignment that's been in
 * awaiting_confirmation for 48+ hours with no reply, drop a
 * notification into the bell for the whole bishopric so they can
 * chase the speaker manually. Idempotent — assignments with a
 * non-null silence_flagged_at are skipped so we never re-ping.
 *
 * Manual trigger for testing:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://your-domain/api/cron/silent-sweeper
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyBishopric } from "@/lib/notifications";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  program_id: string;
  invited_at: string;
  asked_at: string | null;
  speaker: { full_name: string } | null;
  program: { meeting_date: string } | null;
};

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createServiceClient();
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from("speaking_assignments")
    .select(
      `id, program_id, invited_at, asked_at,
       speaker:speakers(full_name),
       program:programs!inner(meeting_date)`,
    )
    .eq("status", "awaiting_confirmation")
    .is("silence_flagged_at", null)
    .not("invited_at", "is", null)
    .lt("invited_at", cutoff);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as Row[];
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const row of rows) {
    const speaker = row.speaker;
    const program = row.program;
    if (!speaker || !program) {
      results.push({ id: row.id, ok: false, error: "Missing speaker or program" });
      continue;
    }
    const meetingLabel = new Date(program.meeting_date + "T00:00:00").toLocaleDateString(
      "en-US",
      { weekday: "long", month: "long", day: "numeric" },
    );
    await notifyBishopric({
      type: "speaker_silent",
      title: `${speaker.full_name} hasn't replied — ${meetingLabel}`,
      body: "It's been 48 hours since the invite went out. You may want to follow up.",
      actionUrl: `/programs/${row.program_id}`,
    });
    const { error: ue } = await sb
      .from("speaking_assignments")
      .update({ silence_flagged_at: new Date().toISOString() })
      .eq("id", row.id);
    if (ue) {
      results.push({ id: row.id, ok: false, error: ue.message });
      continue;
    }
    results.push({ id: row.id, ok: true });
  }

  return NextResponse.json({
    cutoff,
    candidates: rows.length,
    flagged: results.filter((r) => r.ok).length,
    results,
  });
}
