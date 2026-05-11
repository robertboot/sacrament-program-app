// Minimal iCal parser — just enough for the church calendar feed.
// Handles line-folding, parameter-suffixed properties, and DTSTART in either
// all-day (`VALUE=DATE`) or zoned datetime form.

export type IcalEvent = {
  uid: string;
  summary: string;
  description: string | null;
  /** ISO date `YYYY-MM-DD` — the calendar date, time/zone discarded. */
  date: string;
};

function unfold(text: string): string[] {
  // iCal folds long lines onto continuation lines starting with space or tab.
  const joined = text.replace(/\r?\n[\t ]/g, "");
  return joined.split(/\r?\n/);
}

function unescape(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseDate(value: string): string | null {
  // Either "YYYYMMDD" (all-day) or "YYYYMMDDTHHmmSS[Z]".
  if (!/^\d{8}/.test(value)) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function cleanSummary(s: string): string {
  return s
    .replace(/\s*-\s*Churchwide Events\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDescription(s: string | null): string | null {
  if (!s) return null;
  return (
    s
      // Drop the boilerplate "See events.ChurchofJesusChrist.org" sentence.
      .replace(/See events\.churchofjesuschrist\.org\.?/gi, "")
      .trim() || null
  );
}

export function parseIcal(text: string): IcalEvent[] {
  const lines = unfold(text);
  const out: IcalEvent[] = [];
  let cur: Record<string, string> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur) {
        const uid = cur["UID"];
        const summary = cleanSummary(unescape(cur["SUMMARY"] ?? ""));
        const description = cleanDescription(
          cur["DESCRIPTION"] ? unescape(cur["DESCRIPTION"]) : null,
        );
        const date = parseDate(cur["DTSTART"] ?? "");
        if (uid && summary && date) {
          out.push({ uid, summary, description, date });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;

    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const keyPart = line.slice(0, colon);
    const value = line.slice(colon + 1);
    // Strip parameters like "DTSTART;TZID=America/Denver" → "DTSTART".
    const key = keyPart.split(";")[0].toUpperCase();
    cur[key] = value;
  }

  return out;
}
