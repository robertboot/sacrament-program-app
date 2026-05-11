/**
 * Twilio SMS sender. Reads credentials from env at call time so missing config
 * surfaces as a clear error message rather than a build-time failure.
 *
 * Required env vars (set in Vercel + .env.local):
 *   TWILIO_ACCOUNT_SID   - Account SID from Twilio console
 *   TWILIO_AUTH_TOKEN    - Auth token from Twilio console
 *   TWILIO_FROM_NUMBER   - Twilio-owned phone in E.164 format (e.g. +12055551234)
 */

export type SmsResult = { ok: true; sid: string } | { ok: false; error: string };

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return {
      ok: false,
      error:
        "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.",
    };
  }
  const normalized = normalizeToE164(to);
  if (!normalized) {
    return { ok: false, error: `Phone number "${to}" isn't a valid format.` };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const body_ = new URLSearchParams({ To: normalized, From: from, Body: body });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body_,
    },
  );
  const json = (await res.json()) as { sid?: string; message?: string };
  if (!res.ok) {
    return { ok: false, error: json.message ?? `Twilio error ${res.status}` };
  }
  return { ok: true, sid: json.sid! };
}

/** US-centric: accept (205) 555-1234 / 205-555-1234 / 2055551234 / +12055551234. */
export function normalizeToE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) {
    return digits.length >= 8 ? `+${digits}` : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
