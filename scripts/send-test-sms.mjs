// One-off: send a test SMS to verify Twilio is wired up correctly.
//
// Usage:
//   node scripts/send-test-sms.mjs "<phone>" "<message>"
//
// Reads Twilio creds from .env.local (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
// TWILIO_FROM_NUMBER). Add those to .env.local before running.

import { readFileSync } from "fs";

const [, , toArg, ...rest] = process.argv;
if (!toArg) {
  console.error('Usage: node scripts/send-test-sms.mjs "<phone>" "<message>"');
  process.exit(1);
}
const message =
  rest.join(" ") ||
  "Test from Sacrament Program Planner — if you see this, Twilio is wired up correctly.";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const sid = env.TWILIO_ACCOUNT_SID;
const token = env.TWILIO_AUTH_TOKEN;
const from = env.TWILIO_FROM_NUMBER;
if (!sid || !token || !from) {
  console.error(
    "Missing Twilio config in .env.local. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.",
  );
  process.exit(1);
}

function toE164(raw) {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) return digits.length >= 8 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
const to = toE164(toArg);
if (!to) {
  console.error(`"${toArg}" doesn't look like a valid phone number.`);
  process.exit(1);
}

const auth = Buffer.from(`${sid}:${token}`).toString("base64");
const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
  method: "POST",
  headers: {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({ To: to, From: from, Body: message }),
});
const json = await res.json();
if (!res.ok) {
  console.error(`Twilio error ${res.status}:`, json.message ?? json);
  process.exit(1);
}
console.log(`Sent. Twilio message SID: ${json.sid}`);
