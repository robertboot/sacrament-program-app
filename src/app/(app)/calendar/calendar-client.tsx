"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Copy, MessageSquare, Pencil, RefreshCw, Trash2, Plus, Calendar as CalendarIcon, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CollapsibleCard } from "@/components/collapsible-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cancelBooking,
  createMeetingBlock,
  deleteMeetingBlock,
  regenerateBookingToken,
  toggleCalendarEnabled,
  toggleTithingDeclarations,
  updateBooking,
} from "./actions";
import type { BookableMeetingType, MeetingBlock, MeetingBooking, SacramentEvent } from "@/lib/supabase/types";
import {
  BOOKING_HORIZON_WEEKS,
  expandBlockForDate,
  MEETING_TYPE_DURATION_MIN,
} from "@/lib/meeting-slots";
import {
  BRANCH_TIMEZONE,
  formatTzDateTimeShort,
  formatTzTime,
  wallClockInBranchTzToUtcIso,
} from "@/lib/branch-timezone";
import { availableSlotsForDate } from "@/lib/meeting-slots";
import { CalendarMonthView } from "./calendar-month-view";

const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NTH_NAMES = ["first", "second", "third", "fourth", "fifth"];
const MEETING_TYPE_LABELS: Record<MeetingBooking["meeting_type"], string> = {
  interview_30: "Interview (30 min)",
  interview_60: "Interview (60 min)",
  tithing_declaration: "Tithing declaration (15 min)",
};

export function CalendarClient({
  calendarEnabled,
  tithingEnabled,
  bookingToken,
  upcomingBookings,
  blocks,
  events,
}: {
  calendarEnabled: boolean;
  tithingEnabled: boolean;
  bookingToken: string | null;
  upcomingBookings: MeetingBooking[];
  blocks: MeetingBlock[];
  events: SacramentEvent[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editingBooking, setEditingBooking] = useState<MeetingBooking | null>(null);
  // Persist the view choice per device so leaders don't re-pick it on
  // every visit. Start with "list" on both server and client's first
  // render to avoid a hydration mismatch; useEffect then syncs to the
  // stored value after mount.
  const [view, setView] = useState<"list" | "calendar">("list");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("rota:calendar-view");
      if (stored === "calendar" || stored === "list") setView(stored);
    } catch {
      // ignore — localStorage can throw in private mode / certain embedding contexts
    }
  }, []);
  function setViewAndPersist(v: "list" | "calendar") {
    setView(v);
    try {
      localStorage.setItem("rota:calendar-view", v);
    } catch {
      // ignore
    }
  }

  const bookingUrl = useMemo(() => {
    if (!bookingToken) return null;
    if (typeof window === "undefined") return null;
    return `${window.location.origin}/book/${bookingToken}`;
  }, [bookingToken]);

  // Combined upcoming feed: member bookings + expanded block occurrences
  // on each day across the horizon. Blocks render as a muted "Blocked"
  // row so the leader sees why a slot is unavailable in context, without
  // having to cross-reference the Meeting blocks card below.
  const upcomingItems = useMemo(
    () => buildUpcomingItems(upcomingBookings, blocks),
    [upcomingBookings, blocks],
  );

  function copyLink() {
    if (!bookingUrl) return;
    navigator.clipboard?.writeText(bookingUrl);
    toast.success("Link copied.");
  }

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Share a scheduling link with members, block off busy time, and
          see every upcoming meeting at a glance.
        </p>
      </div>

      {/* List / Calendar view toggle. localStorage-persisted via
          setViewAndPersist. The month-view card renders bookings +
          blocks + events together; the list view is the existing admin
          surface (toggles, bookings list, blocks CRUD). */}
      <div className="inline-flex rounded-md ring-1 ring-border p-0.5 bg-muted/50">
        <button
          type="button"
          onClick={() => setViewAndPersist("list")}
          className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded ${
            view === "list" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          <List className="w-4 h-4" /> List
        </button>
        <button
          type="button"
          onClick={() => setViewAndPersist("calendar")}
          className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded ${
            view === "calendar" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          <LayoutGrid className="w-4 h-4" /> Calendar
        </button>
      </div>

      {view === "calendar" && (
        <CollapsibleCard title="This month" defaultOpen contentClassName="space-y-2">
          <CalendarMonthView
            bookings={upcomingBookings}
            blocks={blocks}
            events={events}
          />
        </CollapsibleCard>
      )}

      {view === "list" && (
        <CollapsibleCard
          title={`Upcoming meetings (${upcomingItems.length})`}
          defaultOpen
          contentClassName="p-0"
        >
          {upcomingItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No bookings yet.
            </p>
          ) : (
            <div>
              {groupItemsByBranchDay(upcomingItems).map(([key, dayItems]) => (
                <div key={key}>
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-y">
                    {formatDateHeader(key)}
                  </div>
                  <ul className="divide-y">
                    {dayItems.map((item) =>
                      item.kind === "booking" ? (
                        <li
                          key={item.id}
                          className="px-3 py-2 flex items-start gap-3 justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm">
                              <span className="font-medium">{item.booking.member_name}</span>
                              <span className="text-muted-foreground">
                                {" "}
                                · {MEETING_TYPE_LABELS[item.booking.meeting_type]}
                              </span>
                            </div>
                            {item.booking.additional_attendees && (
                              <div className="text-xs text-muted-foreground">
                                + {item.booking.additional_attendees}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              {formatTzTime(item.booking.start_at)}
                              {item.booking.member_phone ? ` · ${item.booking.member_phone}` : ""}
                              {item.booking.member_email ? ` · ${item.booking.member_email}` : ""}
                            </div>
                          </div>
                          {item.booking.member_phone && (
                            <a
                              href={buildReminderSmsUrl(item.booking)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-800 dark:text-blue-200 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 rounded-md px-2 py-1 border border-blue-200 dark:border-blue-900"
                              title="Open Messages pre-filled with a reminder for this meeting"
                            >
                              <MessageSquare className="w-3.5 h-3.5" /> Text
                            </a>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingBooking(item.booking)}
                            disabled={pending}
                            aria-label="Edit booking"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              start(async () => {
                                if (!confirm(`Cancel ${item.booking.member_name}'s meeting?`)) return;
                                const r = await cancelBooking(item.booking.id);
                                if (r.error) toast.error(r.error);
                                else {
                                  toast.success("Cancelled.");
                                  router.refresh();
                                }
                              })
                            }
                            disabled={pending}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </li>
                      ) : (
                        <li
                          key={item.id}
                          className="px-3 py-2 flex items-start gap-3 bg-zinc-100/60 dark:bg-zinc-800/40"
                        >
                          <Ban className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm">
                              <span className="font-medium">{item.label}</span>
                              <span className="text-muted-foreground"> · Blocked</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatTzTime(new Date(item.startMs))} – {formatTzTime(new Date(item.endMs))}
                            </div>
                          </div>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CollapsibleCard>
      )}

      <CollapsibleCard title="Scheduling link" defaultOpen contentClassName="space-y-3">
        <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
          <Checkbox
            checked={calendarEnabled}
            onCheckedChange={(v) =>
              start(async () => {
                const r = await toggleCalendarEnabled(v === true);
                if (r.error) toast.error(r.error);
                else router.refresh();
              })
            }
            disabled={pending}
            className="mt-0.5"
          />
          <div className="space-y-0.5">
            <div className="font-medium">Scheduling is open to members</div>
            <p className="text-xs text-muted-foreground">
              When on, the link below works and members can book slots.
              When off, the link returns &ldquo;scheduling closed.&rdquo;
            </p>
          </div>
        </label>
        <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
          <Checkbox
            checked={tithingEnabled}
            onCheckedChange={(v) =>
              start(async () => {
                const r = await toggleTithingDeclarations(v === true);
                if (r.error) toast.error(r.error);
                else router.refresh();
              })
            }
            disabled={pending}
            className="mt-0.5"
          />
          <div className="space-y-0.5">
            <div className="font-medium">Tithing declarations open</div>
            <p className="text-xs text-muted-foreground">
              Turn on in September; turn off at the end of November. When
              on, &ldquo;Tithing declaration (30 min)&rdquo; appears as a
              bookable type.
            </p>
          </div>
        </label>
        <div className="pt-2 border-t space-y-2">
          <Label>Public booking link</Label>
          <div className="flex gap-2 flex-wrap">
            <Input
              readOnly
              value={bookingUrl ?? "(no token yet — regenerate below)"}
              className="flex-1 min-w-0 text-xs"
            />
            <Button variant="outline" onClick={copyLink} disabled={!bookingUrl}>
              <Copy className="w-4 h-4" /> Copy
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                start(async () => {
                  const r = await regenerateBookingToken();
                  if (r.error) toast.error(r.error);
                  else {
                    toast.success("New link — the old one is now invalid.");
                    router.refresh();
                  }
                })
              }
              disabled={pending}
            >
              <RefreshCw className="w-4 h-4" /> Regenerate
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Regenerating invalidates the old link immediately.
          </p>
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title={`Meeting blocks (${blocks.length})`}
        description="Reserve time so members can't book it — one-off or recurring (e.g. BYC 2nd Sunday 12:05)."
        defaultOpen
        contentClassName="space-y-2"
      >
        <div>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> Add block
          </Button>
        </div>
        {blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            No blocks yet.
          </p>
        ) : (
          <ul className="divide-y border rounded-md">
            {blocks.map((b) => (
              <li
                key={b.id}
                className="px-3 py-2 flex items-start gap-3 justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{b.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {describeBlock(b)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    start(async () => {
                      if (!confirm(`Delete block "${b.label}"?`)) return;
                      const r = await deleteMeetingBlock(b.id);
                      if (r.error) toast.error(r.error);
                      else {
                        toast.success("Deleted.");
                        router.refresh();
                      }
                    })
                  }
                  disabled={pending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleCard>

      <AddBlockDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => router.refresh()}
      />

      <EditBookingDialog
        booking={editingBooking}
        blocks={blocks}
        allBookings={upcomingBookings}
        onClose={() => setEditingBooking(null)}
        onSaved={() => {
          setEditingBooking(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function describeBlock(b: MeetingBlock): string {
  if (b.recurrence_kind === null) {
    if (!b.start_at || !b.end_at) return "—";
    return `${formatTzDateTimeShort(b.start_at)} – ${formatTzTime(b.end_at)}`;
  }
  const dow = DOW_NAMES[b.recurrence_day_of_week ?? 0];
  const time = formatTime(b.recurrence_time ?? "00:00");
  const dur = b.recurrence_duration_minutes ?? 0;
  if (b.recurrence_kind === "weekly") {
    return `Every ${dow} · ${time} · ${dur} min`;
  }
  return `${NTH_NAMES[(b.recurrence_nth ?? 1) - 1]} ${dow} of each month · ${time} · ${dur} min`;
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Share one 12h formatter between the slot grid and the "current slot
 *  isn't available" warning so they stay consistent. */
function formatSlotLabel(hhmm: string): string {
  return formatTime(hhmm);
}

/**
 * One row in the combined Upcoming list — either a member booking or a
 * single expanded occurrence of an admin-managed meeting_blocks row.
 */
type UpcomingItem =
  | { kind: "booking"; id: string; startMs: number; booking: MeetingBooking }
  | { kind: "block"; id: string; startMs: number; endMs: number; label: string };

/**
 * Merge member bookings with every block occurrence that fires between
 * today and the end of the booking horizon. Sorted ascending by start.
 * Past occurrences are filtered out so the list matches the server-side
 * cutoff on bookings (`start_at >= now`).
 */
function buildUpcomingItems(
  bookings: MeetingBooking[],
  blocks: MeetingBlock[],
): UpcomingItem[] {
  const items: UpcomingItem[] = bookings.map((b) => ({
    kind: "booking",
    id: b.id,
    startMs: new Date(b.start_at).getTime(),
    booking: b,
  }));
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const nowMs = Date.now();
  const horizonDays = BOOKING_HORIZON_WEEKS * 7;
  for (let i = 0; i < horizonDays; i++) {
    const day = new Date(
      todayStart.getFullYear(),
      todayStart.getMonth(),
      todayStart.getDate() + i,
    );
    for (const b of blocks) {
      const r = expandBlockForDate(b, day);
      if (!r) continue;
      if (r.startMs < nowMs) continue;
      items.push({
        kind: "block",
        id: `${b.id}-${r.startMs}`,
        startMs: r.startMs,
        endMs: r.endMs,
        label: b.label,
      });
    }
  }
  items.sort((a, b) => a.startMs - b.startMs);
  return items;
}

/**
 * Bucket mixed Upcoming items by the branch-TZ calendar day of their
 * start. Keys are "YYYY-MM-DD" in Central Time.
 */
function groupItemsByBranchDay(
  items: UpcomingItem[],
): Array<[string, UpcomingItem[]]> {
  const map = new Map<string, UpcomingItem[]>();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRANCH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  for (const it of items) {
    const key = fmt.format(new Date(it.startMs));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  return Array.from(map.entries());
}

/** "Sunday, November 22" — the date-group header on the Upcoming list. */
function formatDateHeader(key: string): string {
  const [y, mo, d] = key.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Build an `sms:` URL that opens the leader's native Messages app with
 * the member's phone pre-filled and a friendly reminder body ready to
 * send. Mirrors the speaker-reminder pattern (CLAUDE.md §18): no
 * Twilio, the leader taps Send from their own number.
 */
function buildReminderSmsUrl(b: MeetingBooking): string {
  const d = new Date(b.start_at);
  const dateLabel = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: BRANCH_TIMEZONE,
  });
  const timeLabel = formatTzTime(b.start_at);
  const firstName = b.member_name.trim().split(/\s+/)[0] || b.member_name;
  const body = [
    `Hi ${firstName}, just a friendly reminder about your ${MEETING_TYPE_LABELS[b.meeting_type].toLowerCase()} on ${dateLabel} at ${timeLabel}.`,
    `See you then!`,
  ].join("\n\n");
  const cleanPhone = (b.member_phone ?? "").replace(/[^\d+]/g, "");
  return `sms:${cleanPhone}?body=${encodeURIComponent(body)}`;
}

function AddBlockDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<"one_off" | "weekly" | "monthly_nth">("monthly_nth");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:05");
  const [duration, setDuration] = useState(45);
  const [dow, setDow] = useState(0);
  const [nth, setNth] = useState(2);

  function submit() {
    if (!label.trim()) {
      toast.error("Label is required.");
      return;
    }
    start(async () => {
      let input: Parameters<typeof createMeetingBlock>[0];
      if (kind === "one_off") {
        if (!date || !time) {
          toast.error("Pick a date and time.");
          return;
        }
        input = {
          kind: "one_off",
          label: label.trim(),
          start_at: new Date(`${date}T${time}:00`).toISOString(),
          duration_minutes: duration,
        };
      } else if (kind === "weekly") {
        input = {
          kind: "weekly",
          label: label.trim(),
          day_of_week: dow,
          time,
          duration_minutes: duration,
        };
      } else {
        input = {
          kind: "monthly_nth",
          label: label.trim(),
          day_of_week: dow,
          nth,
          time,
          duration_minutes: duration,
        };
      }
      const r = await createMeetingBlock(input);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Block added.");
      setLabel("");
      setDate("");
      onCreated();
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add meeting block</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. BYC, Youth interviews"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Repeats</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly_nth">Monthly (e.g. 2nd Sunday)</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="one_off">One-off date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {kind === "one_off" && (
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}
          {kind !== "one_off" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Day of week</Label>
                <Select value={String(dow)} onValueChange={(v) => setDow(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOW_NAMES.map((n, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {kind === "monthly_nth" && (
                <div className="space-y-1.5">
                  <Label>Which one</Label>
                  <Select value={String(nth)} onValueChange={(v) => setNth(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NTH_NAMES.map((n, i) => (
                        <SelectItem key={i} value={String(i + 1)}>
                          {n[0].toUpperCase() + n.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (min)</Label>
              <Input
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              <CalendarIcon className="w-4 h-4" />
              Add block
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Admin-only edit for an existing booking. Pre-fills every field off
 * the booking, splits start_at into date + time inputs (branch TZ) so
 * the leader sees the same wall clock a member would, and on save
 * rebuilds an ISO start from those inputs. Deliberately skips conflict
 * detection — the admin is overriding whatever the automatic
 * slot-generator would have done.
 */
function EditBookingDialog({
  booking,
  blocks,
  allBookings,
  onClose,
  onSaved,
}: {
  booking: MeetingBooking | null;
  blocks: MeetingBlock[];
  allBookings: MeetingBooking[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const [type, setType] = useState<BookableMeetingType>("interview_30");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [attendees, setAttendees] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // SMS URL that proposes the new (date, time) to the member. Null when
  // there's no phone on file or when the admin hasn't actually moved the
  // slot yet — the button is hidden in both cases.
  const proposalSmsUrl = useMemo(() => {
    if (!booking) return null;
    const phone = (booking.member_phone ?? "").trim();
    if (!phone) return null;
    if (!date || !time) return null;
    const originalIso = booking.start_at;
    const proposedIso = wallClockInBranchTzToUtcIso(date, time);
    if (originalIso === proposedIso) return null;
    const firstName =
      booking.member_name.trim().split(/\s+/)[0] || booking.member_name;
    const oldLabel = formatTzDateTimeShort(originalIso);
    const newLabel = formatTzDateTimeShort(proposedIso);
    const body = `Hi ${firstName}, can I move your ${MEETING_TYPE_LABELS[type].toLowerCase()} which was scheduled for ${oldLabel}, to ${newLabel}?`;
    const cleanPhone = phone.replace(/[^\d+]/g, "");
    return `sms:${cleanPhone}?body=${encodeURIComponent(body)}`;
  }, [booking, date, time, type]);

  // Available slots for the current (date, type), excluding the booking
  // being edited so its own slot doesn't conflict with itself.
  const slots = useMemo(() => {
    if (!date || !booking) return [];
    const [y, mo, d] = date.split("-").map(Number);
    const target = new Date(y, mo - 1, d);
    const dayStart = target.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const bookingsThatDay = allBookings.filter((b) => {
      if (b.id === booking.id) return false;
      if (b.status !== "confirmed") return false;
      const t = new Date(b.start_at).getTime();
      return t >= dayStart && t < dayEnd;
    });
    return availableSlotsForDate(
      target,
      MEETING_TYPE_DURATION_MIN[type],
      blocks,
      bookingsThatDay,
    );
  }, [date, type, booking, blocks, allBookings]);

  // Reset form every time a different booking is opened for edit.
  const [trackedId, setTrackedId] = useState<string | null>(null);
  if (booking && booking.id !== trackedId) {
    setTrackedId(booking.id);
    setType(booking.meeting_type);
    const d = new Date(booking.start_at);
    // Extract branch-TZ date / time components so the inputs line up
    // with the clock the member actually booked against.
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: BRANCH_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .reduce<Record<string, string>>((acc, p) => {
        if (p.type !== "literal") acc[p.type] = p.value;
        return acc;
      }, {});
    setDate(`${parts.year}-${parts.month}-${parts.day}`);
    // Normalize 24h "24" (midnight) to "00" — Intl can emit either.
    const hh = parts.hour === "24" ? "00" : parts.hour;
    setTime(`${hh}:${parts.minute}`);
    setName(booking.member_name);
    setAttendees(booking.additional_attendees ?? "");
    setPhone(booking.member_phone ?? "");
    setEmail(booking.member_email ?? "");
  }

  function submit() {
    if (!booking) return;
    if (!name.trim()) {
      toast.error("Member name is required.");
      return;
    }
    if (!date || !time) {
      toast.error("Pick a date and time.");
      return;
    }
    start(async () => {
      // The admin picks a wall clock they see in the dialog, which is
      // branch-TZ. Convert that wall clock → the real UTC instant to
      // store. Using the shared helper so this stays DST-correct and
      // doesn't depend on which TZ the admin's browser happens to be in.
      const startIso = wallClockInBranchTzToUtcIso(date, time);
      const r = await updateBooking(booking.id, {
        meeting_type: type,
        start_at: startIso,
        duration_minutes: MEETING_TYPE_DURATION_MIN[type],
        member_name: name,
        additional_attendees: attendees || null,
        member_phone: phone || null,
        member_email: email || null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Saved.");
      onSaved();
    });
  }

  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit meeting</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Meeting type</Label>
            <Select value={type} onValueChange={(v) => setType(v as BookableMeetingType)}>
              <SelectTrigger>
                <SelectValue>{MEETING_TYPE_LABELS[type]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MEETING_TYPE_LABELS) as BookableMeetingType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {MEETING_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-date">Date</Label>
            <Input
              id="edit-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Start time</Label>
            {slots.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No available slots on that date. Pick a Sunday or Wednesday,
                or free up a blocked range first.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {slots.map((t) => {
                  const [h, mi] = t.split(":").map(Number);
                  const probe = new Date();
                  probe.setHours(h, mi, 0, 0);
                  const label = probe.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  const selected = time === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTime(t)}
                      className={`rounded-md border px-2 py-1.5 text-sm ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-accent"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {time && !slots.includes(time) && slots.length > 0 && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Current slot ({formatSlotLabel(time)}) isn&rsquo;t in the
                available list — pick a new one above.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Member name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-attendees">Additional attendees</Label>
            <Textarea
              id="edit-attendees"
              rows={2}
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="e.g. spouse, children, companion"
            />
            <p className="text-[11px] text-muted-foreground">
              Shown on the booking list under the member&rsquo;s name.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            {proposalSmsUrl && (
              <a
                href={proposalSmsUrl}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border bg-background hover:bg-accent text-sm"
                title="Open Messages pre-filled with a reschedule proposal — doesn't save the change"
              >
                <MessageSquare className="w-4 h-4" /> Propose by text
              </a>
            )}
            <Button onClick={submit} disabled={pending}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
