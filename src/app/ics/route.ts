import { NextRequest } from "next/server";

function escape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/**
 * Single-event ICS generator. Used by the "Add to calendar" icon next to
 * Upcoming Events. A real URL (not a data: URI) so iOS Safari's share sheet
 * can hand it to Calendar or share the link itself.
 *
 * Query params:
 *   title       — event title (required)
 *   date        — YYYY-MM-DD (required, all-day event)
 *   description — optional
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") ?? "").slice(0, 200);
  const date = searchParams.get("date") ?? "";
  const description = (searchParams.get("description") ?? "").slice(0, 1000);

  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("Invalid title or date", { status: 400 });
  }

  const startYmd = date.replaceAll("-", "");
  const d = new Date(`${date}T00:00:00Z`);
  const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  const endYmd = next.toISOString().slice(0, 10).replaceAll("-", "");
  const uid = `${startYmd}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}@rota`;
  const stamp = `${startYmd}T000000Z`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rota//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${startYmd}`,
    `DTEND;VALUE=DATE:${endYmd}`,
    `SUMMARY:${escape(title)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escape(description)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  const body = lines.join("\r\n");
  const filename = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "event"}.ics`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
