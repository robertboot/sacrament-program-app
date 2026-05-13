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

  return (
    <div className="rounded-2xl bg-card ring-1 ring-foreground/10 shadow-sm p-3 sm:p-4 grid grid-cols-[auto_1px_1fr] items-center gap-3 sm:gap-4">
      {locked ? (
        <button
          type="button"
          disabled
          title={`Unlocks ${format(parseISO(unlockDate!), "MMM d, yyyy")}`}
          className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl bg-muted text-muted-foreground cursor-not-allowed shrink-0"
        >
          <Lock className="w-4 h-4" />
          Generate next month
        </button>
      ) : (
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
          className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl bg-[var(--brand-gold)] text-[var(--brand-gold-foreground)] shadow-sm hover:brightness-105 active:brightness-95 disabled:opacity-60 transition shrink-0"
        >
          {pending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Generate next month
        </button>
      )}
      <div aria-hidden className="self-stretch w-px bg-border" />
      <div className="min-w-0 text-xs sm:text-sm">
        {latestMeetingDate ? (
          <p className="font-semibold text-foreground leading-tight">
            Scheduled through{" "}
            {format(parseISO(latestMeetingDate), "MMM d, yyyy")}
          </p>
        ) : (
          <p className="font-semibold text-foreground leading-tight">
            No Sundays scheduled yet
          </p>
        )}
        {locked && (
          <>
            <p className="text-muted-foreground leading-tight mt-1">
              Unlocks {format(parseISO(unlockDate!), "MMM d, yyyy")}
            </p>
            <p className="text-[11px] text-muted-foreground/80 leading-tight mt-0.5">
              (3 months before the last meeting)
            </p>
          </>
        )}
        {!locked && (
          <p className="text-muted-foreground leading-tight mt-1">
            Adds the next four Sundays so the rotation never runs out.
          </p>
        )}
      </div>
    </div>
  );
}
