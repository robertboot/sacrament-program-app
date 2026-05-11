"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, RefreshCw, Cloud, Megaphone } from "lucide-react";
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
import { addDays, format, parseISO } from "date-fns";
import type { SacramentEvent } from "@/lib/supabase/types";
import {
  createEvent,
  deleteEvent,
  syncCalendar,
  toggleBriefReminder,
  updateEvent,
} from "./actions";

export function EventsClient({ initialEvents }: { initialEvents: SacramentEvent[] }) {
  const [editing, setEditing] = useState<SacramentEvent | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [syncing, startSync] = useTransition();

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

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground">
            Announcements that print on programs during the display window.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={doSync} disabled={syncing}>
            {syncing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4" />
            )}
            Sync calendar
          </Button>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> Add event
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {initialEvents.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No events yet.
            </CardContent>
          </Card>
        )}
        {initialEvents.map((e) => (
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
