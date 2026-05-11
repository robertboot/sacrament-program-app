"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Lock } from "lucide-react";
import { ensureNextMonthPrograms } from "./actions";

export function GenerateButton({
  unlockDate,
  latestMeetingDate,
}: {
  unlockDate: string | null;
  latestMeetingDate: string | null;
}) {
  const [pending, start] = useTransition();
  const locked = unlockDate !== null;

  if (locked) {
    return (
      <div className="text-right">
        <Button variant="outline" disabled title={`Unlocks ${format(parseISO(unlockDate!), "MMM d, yyyy")}`}>
          <Lock className="w-4 h-4" />
          Generate next month
        </Button>
        <p className="text-[11px] text-muted-foreground mt-1 max-w-[16rem]">
          Already scheduled through {format(parseISO(latestMeetingDate!), "MMM d, yyyy")}. Unlocks {format(parseISO(unlockDate!), "MMM d, yyyy")} (3 months before the last meeting).
        </p>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={() =>
        start(async () => {
          const r = await ensureNextMonthPrograms();
          if (r.error) toast.error(r.error);
          else if (r.created === 0)
            toast("Nothing to add — that month is already scheduled.");
          else
            toast.success(
              `Added ${r.created} Sunday${r.created === 1 ? "" : "s"}.`,
            );
        })
      }
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Sparkles className="w-4 h-4" />
      )}
      Generate next month
    </Button>
  );
}
