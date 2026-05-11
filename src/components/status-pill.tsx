import { cn } from "@/lib/utils";
import {
  STATUS_DOT_CLASS,
  STATUS_LABELS,
  STATUS_PILL_CLASS,
  STATUS_TONE,
} from "@/lib/assignments";
import type { AssignmentStatus } from "@/lib/supabase/types";

export function StatusPill({
  status,
  past,
  className,
}: {
  status: AssignmentStatus;
  past?: boolean;
  className?: string;
}) {
  if (past) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs",
          "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800",
          className,
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
        Past
      </span>
    );
  }
  const tone = STATUS_TONE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs",
        STATUS_PILL_CLASS[tone],
        className,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT_CLASS[tone])} />
      {STATUS_LABELS[status]}
    </span>
  );
}
