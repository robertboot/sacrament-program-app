"use client";

import { useState, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Speaker } from "@/lib/supabase/types";
import { getSpeakerById } from "@/app/(app)/speakers/actions";
import { SpeakerViewDialog } from "@/components/speaker-view-dialog";
import { SpeakerDialog } from "@/app/(app)/speakers/speakers-client";

/**
 * Inline trigger that fetches a speaker by id and opens the same
 * SpeakerViewDialog the /speakers page uses, so the bishop can pull up a
 * speaker's history straight from the planner. Wrap any text/element to make
 * it the clickable trigger — used on the planner to turn the speaker's name
 * into a visible link.
 *
 * Tapping Edit inside the history dialog now opens the same speaker edit
 * dialog used on /speakers, so contact info can be updated without leaving
 * the planner. If the speaker can't be loaded (deleted, RLS, etc.) the
 * click silently no-ops.
 */
export function SpeakerHistoryButton({
  speakerId,
  speakerName,
  className,
  children,
}: {
  speakerId: string;
  speakerName?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const [viewing, setViewing] = useState<Speaker | null>(null);
  const [editing, setEditing] = useState<Speaker | null>(null);
  const [, start] = useTransition();

  function openDialog(e: React.MouseEvent) {
    // Stop the parent <Link> on the planner row from navigating to /view.
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      const r = await getSpeakerById(speakerId);
      if (r.speaker) setViewing(r.speaker);
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={
          speakerName
            ? `Open ${speakerName}'s speaking history`
            : "Open speaker history"
        }
        onClick={openDialog}
        className={cn(
          "text-left inline-flex items-center text-blue-600 dark:text-blue-400 underline underline-offset-4 hover:text-blue-700 dark:hover:text-blue-300",
          className,
        )}
      >
        {children}
      </button>
      {/*
        Catch clicks inside the dialog so they don't bubble up through React's
        event tree to the parent <Link> wrapping the planner row. (The dialog
        DOM is portaled to document.body, but React events still propagate
        along the JSX hierarchy.) Without this, tapping the X to close the
        dialog also navigates to /view.
      */}
      <span
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <SpeakerViewDialog
          speaker={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            const s = viewing;
            setViewing(null);
            setEditing(s);
          }}
        />
        <SpeakerDialog
          open={!!editing}
          speaker={editing}
          onClose={() => setEditing(null)}
        />
      </span>
    </>
  );
}
