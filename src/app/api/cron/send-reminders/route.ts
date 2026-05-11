/**
 * Daily cron: send a 2-days-out reminder SMS to every confirmed speaker whose
 * meeting falls in 2 days. Idempotent — assignments with a non-null
 * reminded_at are skipped. Run by Vercel Cron (see vercel.json).
 *
 * To trigger manually for testing:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://your-domain/api/cron/send-reminders
 */

import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { createServiceClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/sms";

export const dynamic = "force-dynamic";

const SLOT_LABEL: Record<string, string> = {
  first: "first speaker (≈5 min)",
  second: "second speaker (≈10–15 min)",
  concluding: "concluding speaker (≈15 min)",
};

type Row = {
  id: string;
  slot: "first" | "second" | "concluding";
  custom_topic_text: string | null;
  speaker: { full_name: string; phone: string | null } | null;
  topic: { title: string } | null;
  program: { meeting_date: string } | null;
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
    .select(
      `id, slot, custom_topic_text,
       speaker:speakers(full_name, phone),
       topic:topics(title),
       program:programs!inner(meeting_date)`,
    )
    .eq("status", "confirmed")
    .is("reminded_at", null)
    .eq("program.meeting_date", targetDate);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as Row[];
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const row of rows) {
    const speaker = row.speaker;
    const topic = row.topic;
    const program = row.program;
    if (!speaker?.phone || !program) {
      results.push({ id: row.id, ok: false, error: "Missing phone or program" });
      continue;
    }
    const meetingDate = new Date(program.meeting_date + "T00:00:00").toLocaleDateString(
      "en-US",
      { weekday: "long", month: "long", day: "numeric" },
    );
    const topicText = topic?.title ?? row.custom_topic_text ?? "(no topic on file)";
    const firstName = speaker.full_name.split(/\s+/)[0] || speaker.full_name;

    const body = [
      `Hi ${firstName} — friendly reminder you're speaking in sacrament meeting this ${meetingDate} as ${SLOT_LABEL[row.slot] ?? row.slot}.`,
      `Topic: ${topicText}`,
      `Looking forward to your message. Reach out if you need anything!`,
    ].join("\n\n");

    const sent = await sendSms(speaker.phone, body);
    if (!sent.ok) {
      results.push({ id: row.id, ok: false, error: sent.error });
      continue;
    }
    const { error: ue } = await sb
      .from("speaking_assignments")
      .update({ reminded_at: new Date().toISOString() })
      .eq("id", row.id);
    if (ue) {
      results.push({ id: row.id, ok: false, error: ue.message });
      continue;
    }
    results.push({ id: row.id, ok: true });
  }

  return NextResponse.json({
    target_date: targetDate,
    candidates: rows.length,
    sent: results.filter((r) => r.ok).length,
    results,
  });
}
