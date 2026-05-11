/**
 * Minimal iCalendar (.ics) builder for a single VEVENT. Uses "floating" local
 * times — the event lands at 9:00 AM in whatever timezone the recipient is in,
 * which is what you want for a local congregation.
 */

export function buildIcs(input: {
  uid: string;
  meetingDate: string; // yyyy-MM-dd
  startTime?: string; // HH:mm, defaults to "09:00"
  durationMinutes?: number; // defaults to 60
  summary: string;
  description?: string;
  location?: string;
}): string {
  const [yy, mm, dd] = input.meetingDate.split("-");
  const [hh, mi] = (input.startTime ?? "09:00").split(":");
  const start = `${yy}${mm}${dd}T${hh}${mi}00`;
  const endMins = +hh * 60 + +mi + (input.durationMinutes ?? 60);
  const endHh = Math.floor(endMins / 60) % 24;
  const endMi = endMins % 60;
  const end = `${yy}${mm}${dd}T${String(endHh).padStart(2, "0")}${String(endMi).padStart(2, "0")}00`;
  const now = new Date();
  const stamp =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0") +
    "T" +
    String(now.getUTCHours()).padStart(2, "0") +
    String(now.getUTCMinutes()).padStart(2, "0") +
    String(now.getUTCSeconds()).padStart(2, "0") +
    "Z";

  // RFC5545: escape \, ; , and newlines in text fields.
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sacrament Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}@sacrament-program-app`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${esc(input.summary)}`,
  ];
  if (input.description) lines.push(`DESCRIPTION:${esc(input.description)}`);
  if (input.location) lines.push(`LOCATION:${esc(input.location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");

  // RFC5545 mandates CRLF line endings.
  return lines.join("\r\n");
}
