"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
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
        <button
          type="button"
          disabled
          title={`Unlocks ${format(parseISO(unlockDate!), "MMM d, yyyy")}`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md border border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed"
        >
          <Lock className="w-4 h-4" />
          Generate next month
        </button>
        <p className="text-xs text-muted-foreground mt-1 max-w-[16rem]">
          Already scheduled through {format(parseISO(latestMeetingDate!), "MMM d, yyyy")}. Unlocks {format(parseISO(unlockDate!), "MMM d, yyyy")} (3 months before the last meeting).
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
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
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md bg-[var(--brand-gold)] text-[var(--brand-gold-foreground)] shadow-sm hover:brightness-105 active:brightness-95 disabled:opacity-60 transition"
    >
      {pending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Sparkles className="w-4 h-4" />
      )}
      Generate next month
    </button>
  );
}
