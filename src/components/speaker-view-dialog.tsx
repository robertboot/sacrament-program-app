"use client";

import { useEffect, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
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
import { deleteSpeaker, getSpeakerHistory } from "@/app/(app)/speakers/actions";

const CATEGORY_LABEL: Record<SpeakerCategory, string> = {
  first: "5 min",
  second: "10 min",
  concluding: "15 min",
};

/**
 * Speaker detail dialog — info, categories, last-spoke, full speaking
 * history, plus Edit / Close / Delete actions in the footer.
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
  const [pending, start] = useTransition();
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
                      "flex items-baseline gap-2 flex-wrap",
                      e.kind === "upcoming" &&
                        "text-emerald-700 dark:text-emerald-400",
                    )}
                  >
                    <span className="font-medium">
                      {format(parseISO(e.date), "EEE, MMM d, yyyy")}
                    </span>
                    {e.topic && (
                      <span className="text-muted-foreground italic">
                        — {e.topic}
                      </span>
                    )}
                    {e.kind === "upcoming" && (
                      <span className="text-[10px] uppercase tracking-wider ml-auto">
                        Upcoming
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950 mr-auto"
            disabled={pending}
            onClick={() => {
              if (
                !confirm(
                  `Delete ${speaker.full_name} permanently? Past programs will show "—" instead of their name. To keep history but pause assignments, edit and uncheck Active instead.`,
                )
              )
                return;
              start(async () => {
                const r = await deleteSpeaker(speaker.id);
                if (r.error) toast.error(r.error);
                else {
                  toast.success("Speaker deleted.");
                  onClose();
                }
              });
            }}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Close
          </Button>
          <Button onClick={onEdit} disabled={pending}>
            <Pencil className="w-4 h-4" />
            Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
