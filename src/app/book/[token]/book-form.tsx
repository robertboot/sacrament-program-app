"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  availableSlotsForDate,
  MEETING_TYPE_DURATION_MIN,
  MEETING_TYPE_LABELS,
} from "@/lib/meeting-slots";
import type { MeetingBlock, BookableMeetingType } from "@/lib/supabase/types";
import { createPublicBooking } from "@/app/(app)/calendar/actions";

export function BookForm({
  token,
  availableDates,
  tithingAllowed,
  blocks,
  bookings,
}: {
  token: string;
  availableDates: string[]; // yyyy-MM-dd
  tithingAllowed: boolean;
  blocks: MeetingBlock[];
  bookings: { start_at: string; end_at: string }[];
}) {
  const [pending, start] = useTransition();
  const [confirmed, setConfirmed] = useState<{
    date: string;
    time: string;
    label: string;
    /** Full ISO of start_at — used to build the Add-to-Calendar links. */
    startIso: string;
    durationMin: number;
  } | null>(null);

  const [type, setType] = useState<BookableMeetingType>("interview_30");
  const [date, setDate] = useState<string>(availableDates[0] ?? "");
  const [time, setTime] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const availableTypes: BookableMeetingType[] = useMemo(() => {
    const base: BookableMeetingType[] = ["interview_30", "interview_60"];
    return tithingAllowed ? ["tithing_declaration", ...base] : base;
  }, [tithingAllowed]);

  const duration = MEETING_TYPE_DURATION_MIN[type];

  const slots = useMemo(() => {
    if (!date) return [];
    const [y, m, d] = date.split("-").map(Number);
    const target = new Date(y, m - 1, d);
    const dayStart = target.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const bookingsThatDay = bookings.filter((b) => {
      const t = new Date(b.start_at).getTime();
      return t >= dayStart && t < dayEnd;
    });
    return availableSlotsForDate(target, duration, blocks, bookingsThatDay);
  }, [date, duration, blocks, bookings]);

  function submit() {
    if (!date || !time || !name.trim()) {
      toast.error("Pick a date and time, and enter your name.");
      return;
    }
    start(async () => {
      const [y, m, d] = date.split("-").map(Number);
      const [hh, mm] = time.split(":").map(Number);
      const startAt = new Date(y, m - 1, d, hh, mm);
      const r = await createPublicBooking(token, {
        meeting_type: type,
        start_at: startAt.toISOString(),
        duration_minutes: duration,
        member_name: name,
        member_email: email || undefined,
        member_phone: phone || undefined,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setConfirmed({
        date: startAt.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        }),
        time: startAt.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
        label: MEETING_TYPE_LABELS[type],
        startIso: startAt.toISOString(),
        durationMin: duration,
      });
    });
  }

  if (confirmed) {
    const title = `Meeting with the bishopric — ${confirmed.label}`;
    const icsHref = `/ics?title=${encodeURIComponent(title)}&start=${encodeURIComponent(confirmed.startIso)}&duration_min=${confirmed.durationMin}`;
    // Google Calendar's template URL wants compact UTC: 20261115T184500Z/20261115T191500Z
    const gcalFmt = (iso: string) =>
      iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const gcalStart = gcalFmt(confirmed.startIso);
    const gcalEnd = gcalFmt(
      new Date(
        new Date(confirmed.startIso).getTime() + confirmed.durationMin * 60_000,
      ).toISOString(),
    );
    const gcalHref = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${gcalStart}/${gcalEnd}`;
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-900 p-4 text-center space-y-2">
          <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-300 mx-auto" />
          <div className="text-base font-semibold">You&rsquo;re booked.</div>
          <div className="text-sm">
            {confirmed.label}
            <br />
            {confirmed.date} at {confirmed.time}
          </div>
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground text-center">
            Add to your calendar
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-sm">
            <a
              href={icsHref}
              download
              className="inline-flex items-center gap-1 rounded-md border px-3 py-2 hover:bg-accent"
            >
              Apple / Outlook (.ics)
            </a>
            <a
              href={gcalHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-3 py-2 hover:bg-accent"
            >
              Google Calendar
            </a>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          We&rsquo;ll see you then. You can close this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-base">Meeting type</Label>
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v as BookableMeetingType);
            setTime("");
          }}
        >
          <SelectTrigger className="h-12 text-base">
            <SelectValue>{MEETING_TYPE_LABELS[type]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {availableTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {MEETING_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-base">Date</Label>
        <Select
          value={date}
          onValueChange={(v) => {
            setDate(v ?? "");
            setTime("");
          }}
        >
          <SelectTrigger className="h-12 text-base">
            <SelectValue placeholder="Pick a date">
              {date ? formatDateLabel(date) : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {availableDates.map((d) => (
              <SelectItem key={d} value={d}>
                {formatDateLabel(d)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-base">Time</Label>
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No times available on that date. Please pick another.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((t) => {
              const [h, m] = t.split(":").map(Number);
              const d = new Date();
              d.setHours(h, m, 0, 0);
              const label = d.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
                  className={`rounded-md border px-2 py-2.5 text-base ${
                    time === t
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
      </div>

      <div className="space-y-1.5">
        <Label className="text-base">Your name</Label>
        <Input
          className="h-12 text-base"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First Last"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-base">Phone (optional)</Label>
        <Input
          className="h-12 text-base"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 123-4567"
        />
        <p className="text-xs text-muted-foreground">
          Shared only with the bishopric so they can text you a reminder.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-base">Email (optional)</Label>
        <Input
          className="h-12 text-base"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <Button
        onClick={submit}
        disabled={pending || !time || !name.trim()}
        className="w-full"
      >
        {pending ? "Booking…" : "Confirm booking"}
      </Button>
    </div>
  );
}

/** yyyy-MM-dd → "Sun, Oct 18" — used both in the trigger label and the
 *  dropdown items so the collapsed Select mirrors what the member picked. */
function formatDateLabel(iso: string): string {
  const [y, mo, da] = iso.split("-").map(Number);
  return new Date(y, mo - 1, da).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
