"use client";

import Link from "next/link";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { CheckCircle2, XCircle } from "lucide-react";
import { CollapsibleCard } from "@/components/collapsible-card";

export type RecentUpdate = {
  assignmentId: string;
  programId: string;
  meetingDate: string;
  speakerName: string;
  response: "confirmed" | "declined";
  respondedAt: string;
  declineReason: string | null;
  source: "self" | "manual" | null;
};

/**
 * Recent Updates card on the Planner. Shows the last N speaker responses
 * across every upcoming program. Capped visible height at ~5 rows; the
 * container scrolls to see the rest so the card never dominates the page.
 */
export function RecentUpdates({ items }: { items: RecentUpdate[] }) {
  if (items.length === 0) {
    return (
      <CollapsibleCard title="Recent updates" defaultOpen={false}>
        <p className="text-sm text-muted-foreground text-center py-2">
          No speaker responses yet.
        </p>
      </CollapsibleCard>
    );
  }

  return (
    <CollapsibleCard
      title={`Recent updates${items.length ? ` (${items.length})` : ""}`}
      defaultOpen
      contentClassName="p-0"
    >
      {/* ~5 rows fit before the container starts scrolling. Each row is
          about 3rem tall including padding, so 16rem gives a soft cap
          that shows about 5 without a lot of empty space. */}
      <div className="max-h-64 overflow-y-auto divide-y divide-border">
        {items.map((u) => (
          <Row key={u.assignmentId + u.respondedAt} update={u} />
        ))}
      </div>
    </CollapsibleCard>
  );
}

function Row({ update }: { update: RecentUpdate }) {
  const isConfirmed = update.response === "confirmed";
  const when = formatDistanceToNowStrict(parseISO(update.respondedAt), {
    addSuffix: true,
  });
  const meetingLabel = new Date(update.meetingDate + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "short", month: "short", day: "numeric" },
  );

  return (
    <Link
      href={`/programs/${update.programId}`}
      className="block px-3 py-2 hover:bg-accent transition-colors"
    >
      <div className="flex items-start gap-2">
        {isConfirmed ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-tight">
            <span className="font-medium">{update.speakerName}</span>{" "}
            <span
              className={
                isConfirmed
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-700 dark:text-red-400"
              }
            >
              {isConfirmed ? "confirmed" : "declined"}
            </span>{" "}
            <span className="text-muted-foreground">
              for {meetingLabel}
              {update.source === "self" ? " (via text)" : ""}
            </span>
          </div>
          {update.declineReason && (
            <p className="text-xs italic text-red-700 dark:text-red-400 mt-0.5 line-clamp-2">
              &ldquo;{update.declineReason}&rdquo;
            </p>
          )}
          <div className="text-[10px] text-muted-foreground/70 mt-0.5">{when}</div>
        </div>
      </div>
    </Link>
  );
}
