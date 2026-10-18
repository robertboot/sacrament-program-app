import { NextRequest } from "next/server";

function escape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function fmtUtc(d: Date): string {
  // iCal UTC format: 20261115T184500Z
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${mo}${da}T${h}${mi}${s}Z`;
}

/**
 * Single-event ICS generator. A real URL (not a data: URI) so iOS
 * Safari's share sheet can hand it to Calendar.
 *
 * Query params — two modes:
 *   title       — event title (required)
 *   description — optional
 *
 *   All-day mode:
 *     date      — YYYY-MM-DD (DTSTART/DTEND as DATE values)
 *
 *   Timed mode:
 *     start         — ISO 8601 datetime, interpreted as UTC
 *                     (e.g. 2026-11-15T18:45:00Z or without the Z)
 *     duration_min  — integer minutes (optional, defaults to 30)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") ?? "").slice(0, 200);
  const date = searchParams.get("date") ?? "";
  const startIso = searchParams.get("start") ?? "";
  const durationMin = Number(searchParams.get("duration_min") ?? "30") || 30;
  const description = (searchParams.get("description") ?? "").slice(0, 1000);

  if (!title) return new Response("Invalid title", { status: 400 });

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rota//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
  ];

  let fileSlug = title;

  if (startIso) {
    // Timed event (used by the booking confirmation page).
    const start = new Date(startIso);
    if (isNaN(start.getTime())) {
      return new Response("Invalid start", { status: 400 });
    }
    const end = new Date(start.getTime() + durationMin * 60_000);
    const stamp = fmtUtc(new Date());
    const uid = `${fmtUtc(start)}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}@rota`;
    lines.push(
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${fmtUtc(start)}`,
      `DTEND:${fmtUtc(end)}`,
      `SUMMARY:${escape(title)}`,
    );
    fileSlug = `${title}-${fmtUtc(start).slice(0, 8)}`;
  } else {
    // All-day event (existing path — Upcoming Events "Add to calendar").
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response("Invalid date", { status: 400 });
    }
    const startYmd = date.replaceAll("-", "");
    const d = new Date(`${date}T00:00:00Z`);
    const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    const endYmd = next.toISOString().slice(0, 10).replaceAll("-", "");
    const uid = `${startYmd}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}@rota`;
    const stamp = `${startYmd}T000000Z`;
    lines.push(
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${startYmd}`,
      `DTEND;VALUE=DATE:${endYmd}`,
      `SUMMARY:${escape(title)}`,
    );
  }

  if (description) lines.push(`DESCRIPTION:${escape(description)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  const body = lines.join("\r\n");
  const filename = `${fileSlug.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "event"}.ics`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
