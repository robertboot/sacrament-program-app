"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  STATUS_DOT_CLASS,
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
}: {
  assignmentId: string;
  status: AssignmentStatus;
  past?: boolean;
  hasSpeaker: boolean;
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();

  if (past) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs",
          "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800",
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
        Past
      </span>
    );
  }

  const tone = STATUS_TONE[status];
  const nextStatus = NEXT_STATUS[status];
  const canAdvance = canEdit && hasSpeaker && nextStatus !== null;

  const pillContent = (
    <>
      <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT_CLASS[tone])} />
      {STATUS_LABELS[status]}
    </>
  );

  if (!canAdvance) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs",
          STATUS_PILL_CLASS[tone],
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
        // Don't follow the parent <Link>; we're handling the click here.
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
      )}
    >
      {pillContent}
    </button>
  );
}
