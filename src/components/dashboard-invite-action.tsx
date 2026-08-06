"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, UserPen } from "lucide-react";
import {
  sendAssignmentInvite,
  buildReminderInvite,
} from "@/app/(app)/programs/[id]/actions";
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
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline"
          title={`${speakerName} has no phone number on file — open the Speakers page to add one`}
          onClick={(e) => e.stopPropagation()}
        >
          <UserPen className="w-4 h-4" />
          Add phone number to send invitation
        </Link>
      );
    }
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900 rounded-md px-3 py-2 border border-emerald-200 dark:border-emerald-900 shadow-sm disabled:opacity-60"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          start(async () => {
            const r = await sendAssignmentInvite(assignmentId);
            if (r.error) {
              toast.error(r.error);
              return;
            }
            // Hand off to the phone's native Messages app pre-filled
            // with the invite body + confirm link. Leader taps Send from
            // their own number — no Twilio in the loop.
            if (r.smsUrl) window.location.href = r.smsUrl;
          });
        }}
      >
        <MessageSquare className="w-4 h-4" />
        {pending ? "Opening…" : "Send invitation"}
      </button>
    );
  }

  if (status === "awaiting_confirmation") {
    const when = invitedAt
      ? `Invited ${formatDistanceToNow(new Date(invitedAt), { addSuffix: true })}`
      : "Invited";
    return (
      <span className="text-sm italic text-muted-foreground">
        {when} — awaiting reply
      </span>
    );
  }

  if (status === "confirmed") {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={
            confirmationSource === "self"
              ? "text-sm italic text-emerald-700 dark:text-emerald-300"
              : "text-sm italic text-muted-foreground"
          }
        >
          {confirmationSource === "self" ? "Self-confirmed via text" : "Marked confirmed"}
        </span>
        {speakerPhone && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 dark:text-blue-200 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 rounded-md px-2 py-1 border border-blue-200 dark:border-blue-900 disabled:opacity-60"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              start(async () => {
                const r = await buildReminderInvite(assignmentId);
                if (r.error) {
                  toast.error(r.error);
                  return;
                }
                if (r.smsUrl) window.location.href = r.smsUrl;
              });
            }}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {pending ? "Opening…" : "Send reminder"}
          </button>
        )}
      </div>
    );
  }

  if (status === "declined") {
    return (
      <span className="text-sm italic text-red-600 dark:text-red-400">
        {confirmationSource === "self" ? "Declined via text" : "Marked declined"}
      </span>
    );
  }

  return null;
}
