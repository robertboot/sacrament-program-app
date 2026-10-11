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
  } | null>(null);

  const [type, setType] = useState<BookableMeetingType>("interview_30");
  const [date, setDate] = useState<string>(availableDates[0] ?? "");
  const [time, setTime] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

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
      });
    });
  }

  if (confirmed) {
    return (
      <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-900 p-4 text-center space-y-2">
        <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-300 mx-auto" />
        <div className="text-base font-semibold">You&rsquo;re booked.</div>
        <div className="text-sm">
          {confirmed.label}
          <br />
          {confirmed.date} at {confirmed.time}
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          We&rsquo;ll see you then. You can close this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Meeting type</Label>
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v as BookableMeetingType);
            setTime("");
          }}
        >
          <SelectTrigger>
            <SelectValue />
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
        <Label>Date</Label>
        <Select
          value={date}
          onValueChange={(v) => {
            setDate(v ?? "");
            setTime("");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Pick a date" />
          </SelectTrigger>
          <SelectContent>
            {availableDates.map((d) => {
              const [y, mo, da] = d.split("-").map(Number);
              const label = new Date(y, mo - 1, da).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              return (
                <SelectItem key={d} value={d}>
                  {label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Time</Label>
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No times available on that date. Please pick another.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
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
                  className={`rounded-md border px-2 py-1.5 text-sm ${
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
        <Label>Your name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First Last"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Email (optional)</Label>
        <Input
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
