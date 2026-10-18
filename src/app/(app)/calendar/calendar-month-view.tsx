"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { expandBlockForDate } from "@/lib/meeting-slots";
import type {
  MeetingBlock,
  MeetingBooking,
  SacramentEvent,
} from "@/lib/supabase/types";

const DOW_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MEETING_TYPE_LABELS: Record<MeetingBooking["meeting_type"], string> = {
  interview_30: "Interview (30 min)",
  interview_60: "Interview (60 min)",
  tithing_declaration: "Tithing declaration",
};

type DayItem =
  | { kind: "booking"; booking: MeetingBooking; label: string; time: string }
  | { kind: "block"; label: string; time: string }
  | { kind: "event"; event: SacramentEvent; label: string };

/**
 * Month-grid view for the Calendar tab. Plots three layers on each cell:
 *   * member bookings (meeting_bookings) — blue dots
 *   * admin blocks (meeting_blocks) — one-off AND recurring, expanded
 *     onto their occurrence dates via the shared slot generator
 *   * sacrament events (events table) with event_date set — amber dots
 *
 * Clicking a day flips the detail panel below the grid to that day's
 * items. Nothing is editable from here — the admin uses the List view
 * for adds / cancels / deletes.
 */
export function CalendarMonthView({
  bookings,
  blocks,
  events,
}: {
  bookings: MeetingBooking[];
  blocks: MeetingBlock[];
  events: SacramentEvent[];
}) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);
  const [cursor, setCursor] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selected, setSelected] = useState<Date>(today);

  const monthDays = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const itemsByDate = useMemo(
    () => buildItemsMap(monthDays, bookings, blocks, events),
    [monthDays, bookings, blocks, events],
  );

  const selectedKey = isoKey(selected);
  const selectedItems = itemsByDate.get(selectedKey) ?? [];

  function goPrev() {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  }
  function goNext() {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  }
  function goToday() {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(today);
  }

  const monthLabel = cursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-base font-semibold">{monthLabel}</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous month"
            className="rounded-md p-1.5 hover:bg-accent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-md px-2 py-1 text-xs font-medium hover:bg-accent"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next month"
            className="rounded-md p-1.5 hover:bg-accent"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {DOW_HEADERS.map((d) => (
          <div key={d} className="px-1 py-1 text-center">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden ring-1 ring-border">
        {monthDays.map((d) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = isSameDay(d, today);
          const isSelected = isSameDay(d, selected);
          const key = isoKey(d);
          const items = itemsByDate.get(key) ?? [];
          const bookingCount = items.filter((i) => i.kind === "booking").length;
          const blockCount = items.filter((i) => i.kind === "block").length;
          const eventCount = items.filter((i) => i.kind === "event").length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(d)}
              className={[
                "min-h-16 bg-card text-left px-1.5 py-1 flex flex-col gap-1 transition-colors",
                inMonth
                  ? "hover:bg-accent"
                  : "bg-muted/40 text-muted-foreground",
                isSelected && "ring-2 ring-primary ring-inset",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div
                className={[
                  "text-[11px] font-semibold self-end rounded-full w-5 h-5 inline-flex items-center justify-center",
                  isToday && "bg-primary text-primary-foreground",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {d.getDate()}
              </div>
              <div className="flex gap-1 flex-wrap">
                {bookingCount > 0 && (
                  <span className="text-[9px] font-semibold bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200 rounded px-1 py-0.5 leading-none">
                    {bookingCount}B
                  </span>
                )}
                {blockCount > 0 && (
                  <span className="text-[9px] font-semibold bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 rounded px-1 py-0.5 leading-none">
                    {blockCount}
                  </span>
                )}
                {eventCount > 0 && (
                  <span className="text-[9px] font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 rounded px-1 py-0.5 leading-none">
                    {eventCount}E
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-md ring-1 ring-border p-3 space-y-2">
        <div className="text-sm font-semibold">
          {selected.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </div>
        {selectedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing scheduled on this day.
          </p>
        ) : (
          <ul className="divide-y">
            {selectedItems.map((item, i) => (
              <li key={i} className="py-1.5 flex items-start gap-2">
                <span
                  className={[
                    "mt-1.5 w-2 h-2 rounded-full shrink-0",
                    item.kind === "booking" && "bg-sky-500",
                    item.kind === "block" && "bg-zinc-400",
                    item.kind === "event" && "bg-amber-500",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden
                />
                <div className="min-w-0 flex-1 text-sm">
                  <div>
                    {item.kind === "booking" && (
                      <>
                        <span className="font-medium">{item.booking.member_name}</span>{" "}
                        <span className="text-muted-foreground">
                          · {MEETING_TYPE_LABELS[item.booking.meeting_type]}
                        </span>
                      </>
                    )}
                    {item.kind === "block" && (
                      <span className="font-medium">{item.label}</span>
                    )}
                    {item.kind === "event" && (
                      <span className="font-medium">{item.label}</span>
                    )}
                  </div>
                  {"time" in item && item.time && (
                    <div className="text-xs text-muted-foreground">{item.time}</div>
                  )}
                  {item.kind === "event" && item.event.description && (
                    <div className="text-xs text-muted-foreground italic">
                      {item.event.description}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <LegendDot className="bg-sky-500" /> Bookings
        <LegendDot className="bg-zinc-400" /> Blocks
        <LegendDot className="bg-amber-500" /> Events
      </div>
    </div>
  );
}

function LegendDot({ className }: { className: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full ${className}`} aria-hidden />
    </span>
  );
}

/**
 * Build the 6-week grid for a month: starts on the Sunday on or before
 * the 1st, ends on the Saturday on or after the last day, so leading /
 * trailing cells show adjacent-month days in muted style.
 */
function buildMonthGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(
      new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i),
    );
  }
  return days;
}

function buildItemsMap(
  days: Date[],
  bookings: MeetingBooking[],
  blocks: MeetingBlock[],
  events: SacramentEvent[],
): Map<string, DayItem[]> {
  const out = new Map<string, DayItem[]>();

  function push(key: string, item: DayItem) {
    const arr = out.get(key) ?? [];
    arr.push(item);
    out.set(key, arr);
  }

  // Bookings — bucket by local date.
  for (const b of bookings) {
    const d = new Date(b.start_at);
    const key = isoKey(d);
    push(key, {
      kind: "booking",
      booking: b,
      label: `${b.member_name} — ${MEETING_TYPE_LABELS[b.meeting_type]}`,
      time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    });
  }

  // Events with a specific date (undated events are only used for display
  // windows on the bulletin, not calendar placement).
  for (const e of events) {
    if (!e.event_date) continue;
    push(e.event_date, { kind: "event", event: e, label: e.title });
  }

  // Blocks — expand recurring onto each visible day; one-off blocks
  // only match on their own date.
  for (const day of days) {
    for (const b of blocks) {
      const r = expandBlockForDate(b, day);
      if (!r) continue;
      const start = new Date(r.startMs);
      const end = new Date(r.endMs);
      push(isoKey(day), {
        kind: "block",
        label: b.label,
        time: `${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
      });
    }
  }

  // Sort each day's items by time string (bookings/blocks have one;
  // events sort to the top).
  for (const [k, arr] of out) {
    arr.sort((a, b) => {
      const at = "time" in a && a.time ? a.time : "";
      const bt = "time" in b && b.time ? b.time : "";
      return at.localeCompare(bt);
    });
    out.set(k, arr);
  }

  return out;
}

function isoKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
