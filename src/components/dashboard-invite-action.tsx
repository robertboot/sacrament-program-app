"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, UserPen } from "lucide-react";
import { sendAssignmentInvite } from "@/app/(app)/programs/[id]/actions";
import type { AssignmentStatus } from "@/lib/supabase/types";

/**
 * Inline action shown under each speaker on a dashboard card:
 *  - status = not_yet_asked + has phone → "Send invitation"
 *  - status = not_yet_asked + no phone  → "Add phone number →"
 *  - status = awaiting_confirmation     → "Invited 2h ago — awaiting reply"
 *  - status = confirmed                 → "Self-confirmed" or "Marked confirmed"
 *  - status = declined                  → "Declined"
 */
export function DashboardInviteAction({
  assignmentId,
  speakerName,
  speakerPhone,
  status,
  invitedAt,
  confirmationSource,
}: {
  assignmentId: string;
  speakerName: string;
  speakerPhone: string | null;
  status: AssignmentStatus;
  invitedAt: string | null;
  confirmationSource: "self" | "manual" | null;
}) {
  const [pending, start] = useTransition();

  if (status === "not_yet_asked") {
    if (!speakerPhone) {
      return (
        <Link
          href="/speakers"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          title={`${speakerName} has no phone number on file — open the Speakers page to add one`}
          onClick={(e) => e.stopPropagation()}
        >
          <UserPen className="w-3 h-3" />
          Add phone number to send invitation
        </Link>
      );
    }
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded px-2 py-0.5 border border-emerald-200 dark:border-emerald-900 disabled:opacity-60"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          start(async () => {
            const r = await sendAssignmentInvite(assignmentId);
            if (r.error) toast.error(r.error);
            else toast.success(`Invitation sent to ${speakerName}.`);
          });
        }}
      >
        <MessageSquare className="w-3 h-3" />
        {pending ? "Sending…" : "Send invitation"}
      </button>
    );
  }

  if (status === "awaiting_confirmation") {
    const when = invitedAt
      ? `Invited ${formatDistanceToNow(new Date(invitedAt), { addSuffix: true })}`
      : "Invited";
    return (
      <span className="text-[11px] italic text-muted-foreground">
        {when} — awaiting reply
      </span>
    );
  }

  if (status === "confirmed") {
    return (
      <span
        className={
          confirmationSource === "self"
            ? "text-[11px] italic text-emerald-700 dark:text-emerald-300"
            : "text-[11px] italic text-muted-foreground"
        }
      >
        {confirmationSource === "self" ? "Self-confirmed via text" : "Marked confirmed"}
      </span>
    );
  }

  if (status === "declined") {
    return (
      <span className="text-[11px] italic text-red-600 dark:text-red-400">
        {confirmationSource === "self" ? "Declined via text" : "Marked declined"}
      </span>
    );
  }

  return null;
}
