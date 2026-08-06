/**
 * Twilio inbound SMS webhook. Configure in Twilio console:
 *   Messaging → Phone numbers → your number → "A MESSAGE COMES IN"
 *   Webhook → POST → https://your-domain/api/sms/inbound
 *
 * Speakers reply Y or N (case-insensitive, with variants like "yes", "no",
 * "can't") to their invite; we look up the most recently invited assignment
 * for their phone number and flip the status. Twilio signature is verified
 * to keep this endpoint from being spoofable.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyBishopric } from "@/lib/notifications";

export const dynamic = "force-dynamic";

type Pending = {
  id: string;
  speaker_name: string;
  speaker_phone: string;
  status: string;
  meeting_date: string;
  /** Present after the decline-reason migration; used to restate the slot
   *  in the Y / N confirmation TwiML. */
  slot?: "first" | "second" | "concluding";
  /** Same — topic title or the free-text custom topic. */
  topic_title?: string | null;
};

const SLOT_LABEL: Record<string, string> = {
  first: "First speaker (about 5 min)",
  second: "Second speaker (about 10–15 min)",
  concluding: "Concluding speaker (about 15 min)",
};

function receiptBlock(
  meetingDate: string,
  slot: string | undefined,
  topic: string | null | undefined,
): string {
  const lines = [`Date: ${meetingDate}`];
  if (slot) lines.push(`Slot: ${SLOT_LABEL[slot] ?? slot}`);
  if (topic) lines.push(`Topic: ${topic}`);
  return lines.join("\n");
}

export async function POST(req: Request) {
  const url = req.url;
  const text = await req.text();
  const form = new URLSearchParams(text);

  if (!verifyTwilioSignature(req, url, form)) {
    return new Response("Forbidden", { status: 403 });
  }

  const from = form.get("From")?.trim() ?? "";
  const body = (form.get("Body") ?? "").trim();
  if (!from || !body) return twimlReply("");

  const sb = createServiceClient();
  const { data, error } = await sb.rpc("resolve_pending_assignment_for_phone", {
    p_phone: from,
  });
  if (error) {
    return twimlReply(
      "Sorry, something went wrong looking up your invitation. Please reply to the bishopric directly.",
    );
  }

  // No pending invite? Check whether this speaker recently declined and
  // was invited to share a reason. If so, treat this inbound as the
  // reason, save it, and fan out the enriched notification.
  if (!data) {
    const { data: awaitingReason } = await sb.rpc(
      "resolve_awaiting_reason_for_phone",
      { p_phone: from },
    );
    if (awaitingReason) {
      const info = awaitingReason as {
        id: string;
        confirm_token: string;
        speaker_name: string;
      };
      await sb
        .from("speaking_assignments")
        .update({ decline_reason: body })
        .eq("id", info.id);
      const { data: prog } = await sb
        .from("speaking_assignments")
        .select("program_id, program:programs!inner(meeting_date)")
        .eq("id", info.id)
        .single();
      const programId = prog?.program_id as string | undefined;
      const meetingDateIso = Array.isArray(prog?.program)
        ? (prog?.program as { meeting_date: string }[])[0]?.meeting_date
        : (prog?.program as { meeting_date: string } | undefined)?.meeting_date;
      const meetingLabel = meetingDateIso
        ? new Date(meetingDateIso + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })
        : "Sunday";
      await notifyBishopric({
        type: "speaker_declined",
        title: `${info.speaker_name} shared a reason for declining (${meetingLabel})`,
        body: `Reason: ${body}`,
        actionUrl: programId ? `/programs/${programId}` : null,
      });
      return twimlReply(
        `Thanks, ${firstName(info.speaker_name)} — we've passed that along to the bishopric.`,
      );
    }
    return twimlReply(
      "We couldn't find a pending speaking invitation for this number. If you think this is wrong, please contact the bishopric.",
    );
  }
  const pending = data as Pending;

  const decision = parseDecision(body);
  if (decision === null) {
    return twimlReply(
      `Hi ${firstName(pending.speaker_name)} — please reply Y to confirm or N to decline.`,
    );
  }

  // Service-role client bypasses RLS, so a direct update is fine. The
  // guard_locked_assignment trigger will keep the timestamps consistent.
  const { data: updated, error: updateErr } = await sb
    .from("speaking_assignments")
    .update({
      status: decision,
      last_response: decision,
      responded_at: new Date().toISOString(),
      confirmation_source: "self",
    })
    .eq("id", pending.id)
    .select("program_id")
    .single();
  if (updateErr) {
    return twimlReply(
      "Sorry, something went wrong recording your response. Please contact the bishopric.",
    );
  }

  const meetingDate = new Date(pending.meeting_date + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" },
  );

  // Fan out an in-app notification to the whole bishopric so leaders see
  // the reply on the bell without having to open the planner. Best-effort:
  // the speaker's Twilio reply always goes through even if this fails.
  const programId = updated?.program_id as string | undefined;
  await notifyBishopric({
    type: decision === "confirmed" ? "speaker_confirmed" : "speaker_declined",
    title:
      decision === "confirmed"
        ? `${pending.speaker_name} confirmed for ${meetingDate}`
        : `${pending.speaker_name} declined for ${meetingDate}`,
    body:
      decision === "declined"
        ? "You'll want to line up a replacement."
        : null,
    actionUrl: programId ? `/programs/${programId}` : null,
  });
  const receipt = receiptBlock(meetingDate, pending.slot, pending.topic_title);
  if (decision === "confirmed") {
    return twimlReply(
      [
        `Thanks ${firstName(pending.speaker_name)}! You're confirmed for:`,
        receipt,
        `We'll be in touch with more details closer to the meeting.`,
      ].join("\n\n"),
    );
  }
  return twimlReply(
    [
      `Thanks for letting us know, ${firstName(pending.speaker_name)}. We'll find someone else. Here's what you were declining, for your records:`,
      receipt,
      `If you'd like to share a reason with the bishopric, just reply now.`,
    ].join("\n\n"),
  );
}

function parseDecision(body: string): "confirmed" | "declined" | null {
  const t = body.trim().toLowerCase();
  if (/^(y|yes|yep|yeah|sure|ok|okay)\b/.test(t) || t === "y") return "confirmed";
  if (/^(n|no|nope|can'?t|cannot|sorry)\b/.test(t) || t === "n") return "declined";
  return null;
}

function firstName(full: string): string {
  return full.split(/\s+/)[0] || full;
}

function twimlReply(message: string): Response {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const twiml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response/>`;
  return new Response(twiml, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

/**
 * Twilio signs every webhook request with HMAC-SHA1 over (url + concat of
 * sorted form fields). We rebuild that and compare. Returns true when the
 * auth token is missing so local dev (with Twilio's test request signer
 * disabled) still works — in production you must set TWILIO_AUTH_TOKEN.
 */
function verifyTwilioSignature(
  req: Request,
  url: string,
  form: URLSearchParams,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const sig = req.headers.get("x-twilio-signature");
  if (!authToken || !sig) return process.env.NODE_ENV !== "production";

  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = v;
  const sortedKeys = Object.keys(params).sort();
  const data = url + sortedKeys.map((k) => k + params[k]).join("");

  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}
