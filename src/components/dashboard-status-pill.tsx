"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  STATUS_DOT_CLASS,
  STATUS_HINT,
  STATUS_LABELS,
  STATUS_PILL_CLASS,
  STATUS_TONE,
} from "@/lib/assignments";
import type { AssignmentStatus } from "@/lib/supabase/types";
import { updateAssignmentStatus } from "@/app/(app)/programs/[id]/actions";

// Status workflow cycles through: ⚫ not_yet_asked → 🟡 awaiting → 🟢 confirmed
// → back to ⚫ not_yet_asked. Lets a misclick on Confirmed unwind without
// reaching for Reset Slot. Declined is terminal — use Reset Slot to restart.
const NEXT_STATUS: Record<AssignmentStatus, AssignmentStatus | null> = {
  not_yet_asked: "awaiting_confirmation",
  awaiting_confirmation: "confirmed",
  confirmed: "not_yet_asked",
  declined: null,
};

export function DashboardStatusPill({
  assignmentId,
  status,
  past,
  hasSpeaker,
  canEdit,
  dotOnly,
  className,
}: {
  assignmentId: string;
  status: AssignmentStatus;
  past?: boolean;
  hasSpeaker: boolean;
  canEdit: boolean;
  /** Hide the status text — just render the colored dot. Used on mobile. */
  dotOnly?: boolean;
  className?: string;
}) {
  const [pending, start] = useTransition();

  if (past) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border",
          dotOnly
            ? "w-7 h-7 border-2 border-zinc-200 bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-700"
            : "px-2 py-0.5 text-xs bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800",
          className,
        )}
        title={dotOnly ? "Past" : undefined}
      >
        {dotOnly ? null : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            Past
          </>
        )}
      </span>
    );
  }

  const tone = STATUS_TONE[status];
  const nextStatus = NEXT_STATUS[status];
  const canAdvance = canEdit && hasSpeaker && nextStatus !== null;
  const label = STATUS_LABELS[status];

  // Dot-only mode: render a colored circle. 28px visible disc with an
  // invisible halo extending the tap area to ~52px so iPhone fingers can
  // hit it cleanly without grazing the underlying card link. Below the
  // disc sits a tiny caption (STATUS_HINT) so leaders can read what the
  // color means from the dashboard without opening the editor.
  if (dotOnly) {
    const dotVisual = cn(
      "inline-block w-7 h-7 rounded-full border-2 border-zinc-200 dark:border-zinc-700 shadow-sm shrink-0",
      STATUS_DOT_CLASS[tone],
      pending && "opacity-50",
    );
    const disc = !canAdvance ? (
      <span className={dotVisual} title={label} />
    ) : (
      <button
        type="button"
        disabled={pending}
        title={`${label} · tap to mark ${STATUS_LABELS[nextStatus]}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          start(async () => {
            const r = await updateAssignmentStatus(assignmentId, nextStatus);
            if (r.error) toast.error(r.error);
            else toast.success(`Marked "${STATUS_LABELS[nextStatus]}".`);
          });
        }}
        className={cn(
          "relative inline-flex items-center justify-center cursor-pointer transition-transform active:scale-95 hover:scale-110",
          "before:absolute before:-inset-3 before:content-['']",
        )}
      >
        <span className={dotVisual} />
      </button>
    );
    return (
      <span
        className={cn(
          "inline-flex flex-col items-center gap-1 shrink-0",
          className,
        )}
      >
        {disc}
        <span className="text-[10px] leading-none text-muted-foreground whitespace-nowrap">
          {STATUS_HINT[status]}
        </span>
      </span>
    );
  }

  // Full pill mode (desktop).
  const pillContent = (
    <>
      <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT_CLASS[tone])} />
      {label}
    </>
  );

  if (!canAdvance) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs",
          STATUS_PILL_CLASS[tone],
          className,
        )}
      >
        {pillContent}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      title={`Click to mark ${STATUS_LABELS[nextStatus]}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(async () => {
          const r = await updateAssignmentStatus(assignmentId, nextStatus);
          if (r.error) toast.error(r.error);
          else toast.success(`Marked "${STATUS_LABELS[nextStatus]}".`);
        });
      }}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs cursor-pointer transition-opacity hover:opacity-80",
        STATUS_PILL_CLASS[tone],
        pending && "opacity-50",
        className,
      )}
    >
      {pillContent}
    </button>
  );
}
