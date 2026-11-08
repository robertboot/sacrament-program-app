/**
 * Pure (server/client safe) helpers for FSY lesson planning. The actual
 * scrape + cache lives in `./fsy-lessons-server`, which this file cannot
 * import without poisoning the client bundle (Supabase's server client
 * drags in `next/headers`).
 */

/**
 * Year themes as published by newsroom.churchofjesuschrist.org each
 * September for the following year. Hardcoded because it's one line per
 * year and this map rarely changes — one PR per year beats scraping a
 * newsroom page. Add the next year's entry here each fall.
 */
export const YEAR_THEMES: Record<number, { title: string; scripture: string }> = {
  2024: { title: "I Can Do All Things Through Christ Which Strengtheneth Me", scripture: "Philippians 4:13" },
  2025: { title: "I Am the Way, the Truth, and the Life", scripture: "John 14:6" },
  2026: { title: "Walk with Me", scripture: "Moses 6:34" },
};

/**
 * Return the "planning month" for an agenda date: the month whose 3rd
 * Wednesday is next AFTER (or on) the agenda date. A Nov 8 agenda
 * plans Nov 18; a Nov 22 agenda plans Dec 16 because Nov 18 has
 * already passed.
 */
export function planningMonthFor(agendaDate: Date): {
  year: number;
  month: number; // 1-indexed
  thirdWednesday: Date;
} {
  const thisThird = thirdWednesdayOf(
    agendaDate.getFullYear(),
    agendaDate.getMonth(),
  );
  if (agendaDate.getTime() <= thisThird.getTime()) {
    return {
      year: agendaDate.getFullYear(),
      month: agendaDate.getMonth() + 1,
      thirdWednesday: thisThird,
    };
  }
  const nextMonthRef = new Date(
    agendaDate.getFullYear(),
    agendaDate.getMonth() + 1,
    1,
  );
  return {
    year: nextMonthRef.getFullYear(),
    month: nextMonthRef.getMonth() + 1,
    thirdWednesday: thirdWednesdayOf(
      nextMonthRef.getFullYear(),
      nextMonthRef.getMonth(),
    ),
  };
}

/** The month AFTER the one returned by planningMonthFor — used to seed
 * the agenda's "Looking Ahead" line. */
export function monthAfter(year: number, month: number): {
  year: number;
  month: number;
  thirdWednesday: Date;
} {
  const next = new Date(year, month, 1); // month here is 1-indexed; +1 via (month, 1)
  return {
    year: next.getFullYear(),
    month: next.getMonth() + 1,
    thirdWednesday: thirdWednesdayOf(next.getFullYear(), next.getMonth()),
  };
}

function thirdWednesdayOf(year: number, monthZeroIndexed: number): Date {
  const first = new Date(year, monthZeroIndexed, 1);
  // Wednesday is getDay() === 3.
  const offset = (3 - first.getDay() + 7) % 7;
  return new Date(year, monthZeroIndexed, 1 + offset + 14);
}

export function monthName(monthOneIndexed: number): string {
  return new Date(2000, monthOneIndexed - 1, 1).toLocaleDateString("en-US", {
    month: "long",
  });
}
