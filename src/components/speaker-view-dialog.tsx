"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { weeksSinceLabel } from "@/lib/dates";
import type { Speaker, SpeakerCategory } from "@/lib/supabase/types";
import { getSpeakerHistory } from "@/app/(app)/speakers/actions";

const CATEGORY_LABEL: Record<SpeakerCategory, string> = {
  first: "5 min",
  second: "10 min",
  concluding: "15 min",
};

/**
 * Speaker detail dialog — info, categories, last-spoke, full speaking
 * history, plus Edit / Close actions in the footer.
 *
 * `onEdit` is supplied by the caller so the same view can switch into the
 * inline edit dialog on the Speakers page, or navigate to /speakers when
 * opened from elsewhere (e.g. the planner).
 */
export function SpeakerViewDialog({
  speaker,
  onClose,
  onEdit,
}: {
  speaker: Speaker | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [history, setHistory] = useState<
    { date: string; kind: "upcoming" | "past"; topic: string | null }[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!speaker?.id) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    getSpeakerHistory(speaker.id).then((r) => {
      if (cancelled) return;
      setHistory(r.entries);
      setHistoryLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [speaker?.id]);

  if (!speaker) return null;

  return (
    <Dialog open={!!speaker} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {speaker.full_name}
            {!speaker.is_active && (
              <Badge variant="outline" className="text-[10px]">
                inactive
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {speaker.categories?.length
              ? speaker.categories
                  .map((c) => CATEGORY_LABEL[c])
                  .filter(Boolean)
                  .join(" · ") + " speaker"
              : "No categories tagged"}{" "}
            · Last spoke {weeksSinceLabel(speaker.last_spoke_date).toLowerCase()}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {speaker.phone && (
            <div className="space-y-0.5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Phone
              </div>
              <div>{speaker.phone}</div>
            </div>
          )}
          {speaker.notes && (
            <div className="space-y-0.5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Notes
              </div>
              <div className="whitespace-pre-wrap">{speaker.notes}</div>
            </div>
          )}
          <div className="space-y-0.5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Speaking history
            </div>
            {historyLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No assignments in the system.
                {speaker.last_spoke_date && (
                  <>
                    {" "}
                    Manual backfill: {weeksSinceLabel(speaker.last_spoke_date)}.
                  </>
                )}
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 text-xs space-y-1">
                {history.map((e) => (
                  <div
                    key={`${e.kind}-${e.date}`}
                    className={cn(
                      e.kind === "upcoming" &&
                        "text-emerald-700 dark:text-emerald-400",
                    )}
                  >
                    {e.kind === "upcoming" && (
                      <div className="text-[10px] uppercase tracking-wider font-semibold">
                        Upcoming
                      </div>
                    )}
                    <div className="font-medium">
                      {format(parseISO(e.date), "EEE, MMM d, yyyy")}
                    </div>
                    {e.topic && (
                      <div className="text-muted-foreground italic">
                        {e.topic}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} >
            Close
          </Button>
          <Button onClick={onEdit} >
            <Pencil className="w-4 h-4" />
            Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
