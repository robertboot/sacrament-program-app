"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Speaker } from "@/lib/supabase/types";
import { getSpeakerById } from "@/app/(app)/speakers/actions";
import { SpeakerViewDialog } from "@/components/speaker-view-dialog";

/**
 * Small gray person avatar button used on the planner rows. Clicking it
 * fetches the full speaker by id and opens the same SpeakerViewDialog that
 * the /speakers page shows when you tap a name, so the bishop can pull up
 * a speaker's history from the dashboard without leaving the page.
 *
 * If the speaker can't be loaded (deleted, RLS, etc.) the click silently
 * no-ops. Edit jumps to /speakers since the planner has no inline edit.
 */
export function SpeakerHistoryButton({
  speakerId,
  speakerName,
  className,
}: {
  speakerId: string;
  speakerName?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [speaker, setSpeaker] = useState<Speaker | null>(null);
  const [, start] = useTransition();

  function openDialog(e: React.MouseEvent) {
    // Stop the parent <Link> on the planner row from navigating to /view.
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      const r = await getSpeakerById(speakerId);
      if (r.speaker) setSpeaker(r.speaker);
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={
          speakerName ? `Open ${speakerName}'s speaking history` : "Open speaker history"
        }
        onClick={openDialog}
        className={cn(
          "w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center shrink-0 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors",
          className,
        )}
      >
        <User className="w-4 h-4" />
      </button>
      <SpeakerViewDialog
        speaker={speaker}
        onClose={() => setSpeaker(null)}
        onEdit={() => router.push("/speakers")}
      />
    </>
  );
}
