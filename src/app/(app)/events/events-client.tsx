"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Cloud,
  Megaphone,
  Search,
  Info,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { addDays, format, parseISO } from "date-fns";
import type { SacramentEvent } from "@/lib/supabase/types";
import {
  createEvent,
  deleteEvent,
  saveCalendarUrl,
  syncCalendar,
  toggleBriefReminder,
  updateEvent,
} from "./actions";

export function EventsClient({
  initialEvents,
  initialCalendarUrl,
}: {
  initialEvents: SacramentEvent[];
  initialCalendarUrl: string | null;
}) {
  const [editing, setEditing] = useState<SacramentEvent | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [syncing, startSync] = useTransition();
  const [search, setSearch] = useState("");
  const [calendarUrl, setCalendarUrl] = useState(initialCalendarUrl ?? "");
  const [savingUrl, startSaveUrl] = useTransition();
  const hasCalendarUrl = !!initialCalendarUrl;

  function saveUrl() {
    const trimmed = calendarUrl.trim();
    if (!trimmed) return;
    startSaveUrl(async () => {
      const r = await saveCalendarUrl(trimmed);
      if (r.error) toast.error(r.error);
      else toast.success("Calendar URL saved. You can now Sync calendar.");
    });
  }

  function doSync() {
    startSync(async () => {
      const r = await syncCalendar();
      if (r.error) toast.error(r.error);
      else
        toast.success(
          `Added ${r.inserted} · refreshed ${r.updated}.`,
        );
    });
  }

  const visibleEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialEvents;
    return initialEvents.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q),
    );
  }, [initialEvents, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>{initialEvents.length} on the calendar</span>
            <span aria-hidden>·</span>
            <span>Printed during the display window</span>
            <Popover>
              <PopoverTrigger
                aria-label="How does the display window work?"
                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              >
                <Info className="w-3.5 h-3.5" />
              </PopoverTrigger>
              <PopoverContent className="text-xs w-64">
                Each event prints at the bottom of every program whose meeting
                date falls between the event&rsquo;s start and end dates.
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <Button onClick={() => setShowAdd(true)} className="shrink-0">
          <Plus className="w-4 h-4" />
          Add event
        </Button>
      </div>

      {!hasCalendarUrl && (
        <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-900">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-amber-700 dark:text-amber-300" />
              <h2 className="font-semibold text-base">Set up your church calendar</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Go to and login to the Church of Jesus Christ website and generate
              a synced calendar URL, which can be found here:{" "}
              <a
                href="https://www.churchofjesuschrist.org/calendar/sync-settings?lang=eng"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 dark:text-blue-400 underline underline-offset-4 break-all"
              >
                https://www.churchofjesuschrist.org/calendar/sync-settings?lang=eng
              </a>{" "}
              after creating your calendar by subscribing to the various feeds,
              click Generate URL and paste below.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Input
                type="url"
                placeholder="https://calendar.churchofjesuschrist.org/…"
                value={calendarUrl}
                onChange={(e) => setCalendarUrl(e.target.value)}
                className="flex-1 min-w-0"
              />
              <Button onClick={saveUrl} disabled={savingUrl || !calendarUrl.trim()}>
                Save URL
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search events by title or description…"
          className="pl-12 h-12 rounded-xl bg-card text-base"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More event actions"
            className="ml-auto inline-flex items-center justify-center rounded-lg bg-card h-7 w-7 ring-1 ring-border hover:bg-muted"
          >
            <MoreVertical className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={doSync} disabled={syncing}>
              {syncing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Cloud className="w-4 h-4" />
              )}
              Sync calendar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2">
        {visibleEvents.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {search.trim()
                ? "No events match that search."
                : "No events yet."}
            </CardContent>
          </Card>
        )}
        {visibleEvents.map((e) => (
          <Card key={e.id} className="py-0">
            <CardContent className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {e.title}
                  {e.external_uid && (
                    <Badge variant="outline" className="text-[10px]">
                      synced
                    </Badge>
                  )}
                  {e.as_brief_reminder && (
                    <Badge className="text-[10px]">
                      <Megaphone className="w-3 h-3" />
                      Brief reminder
                    </Badge>
                  )}
                </div>
                {e.description && (
                  <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">
                    {e.description}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {e.event_date && (
                    <>Date: {format(parseISO(e.event_date), "EEE, MMM d, yyyy")} · </>
                  )}
                  Print on programs {format(parseISO(e.display_start), "MMM d")} —{" "}
                  {format(parseISO(e.display_end), "MMM d, yyyy")}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                title={
                  e.as_brief_reminder
                    ? "Stop showing as brief reminder"
                    : "Show on every program as a brief reminder until the event date"
                }
                onClick={() => {
                  startSync(async () => {
                    const r = await toggleBriefReminder(e.id, !e.as_brief_reminder);
                    if (r.error) toast.error(r.error);
                  });
                }}
                disabled={syncing}
              >
                <Megaphone
                  className={`w-4 h-4 ${e.as_brief_reminder ? "text-amber-600" : ""}`}
                />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(e)}>
                <Pencil className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <EventDialog
        open={showAdd || !!editing}
        ev={editing}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function EventDialog({
  open,
  ev,
  onClose,
}: {
  open: boolean;
  ev: SacramentEvent | null;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(ev?.title ?? "");
  const [description, setDescription] = useState(ev?.description ?? "");
  const [eventDate, setEventDate] = useState(ev?.event_date ?? "");
  const [displayStart, setDisplayStart] = useState(
    ev?.display_start ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [displayEnd, setDisplayEnd] = useState(
    ev?.display_end ?? format(addDays(new Date(), 28), "yyyy-MM-dd"),
  );
  const [asBriefReminder, setAsBriefReminder] = useState(ev?.as_brief_reminder ?? false);
  const [trackedId, setTrackedId] = useState(ev?.id);
  if (ev?.id !== trackedId) {
    setTrackedId(ev?.id);
    setTitle(ev?.title ?? "");
    setDescription(ev?.description ?? "");
    setEventDate(ev?.event_date ?? "");
    setDisplayStart(ev?.display_start ?? format(new Date(), "yyyy-MM-dd"));
    setDisplayEnd(
      ev?.display_end ?? format(addDays(new Date(), 28), "yyyy-MM-dd"),
    );
    setAsBriefReminder(ev?.as_brief_reminder ?? false);
  }

  function onSubmit() {
    if (!title.trim() || !displayStart || !displayEnd) return;
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      event_date: eventDate || null,
      display_start: displayStart,
      display_end: displayEnd,
      as_brief_reminder: asBriefReminder,
    };
    start(async () => {
      const r = ev ? await updateEvent(ev.id, payload) : await createEvent(payload);
      if (r.error) toast.error(r.error);
      else {
        toast.success(ev ? "Event updated." : "Event added.");
        onClose();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ev ? "Edit event" : "Add event"}</DialogTitle>
          <DialogDescription>
            Set the date range during which this event prints at the bottom of programs.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-date">Event date (optional)</Label>
            <Input
              id="event-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Print starting</Label>
              <Input
                type="date"
                value={displayStart}
                onChange={(e) => setDisplayStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Through</Label>
              <Input
                type="date"
                value={displayEnd}
                onChange={(e) => setDisplayEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-start gap-2 border-t pt-3">
            <Checkbox
              id="brief"
              checked={asBriefReminder}
              onCheckedChange={(v) => setAsBriefReminder(v === true)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="brief" className="cursor-pointer">
                Show as brief reminder
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Appears in the Brief Reminders section of every program from now until the
                event date, then automatically stops showing.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {ev && (
            <Button
              variant="outline"
              className="text-red-600"
              onClick={() =>
                start(async () => {
                  const r = await deleteEvent(ev.id);
                  if (r.error) toast.error(r.error);
                  else {
                    toast.success("Event deleted.");
                    onClose();
                  }
                })
              }
              disabled={pending}
            >
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          )}
          <Button onClick={onSubmit} disabled={pending || !title.trim()}>
            {ev ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
