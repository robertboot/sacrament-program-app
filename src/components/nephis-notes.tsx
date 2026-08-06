"use client";

import { useEffect, useState } from "react";
import { BookOpen, X } from "lucide-react";

/**
 * "Nephi's Notes" — a one-time welcome / feature tour that shows at the
 * top of the Planner. Highlights the pieces a leader is most likely to
 * want to know about, then can be dismissed forever with the X.
 *
 * Dismissal is stored in localStorage under a versioned key. Bump
 * DISMISS_KEY when the tour content changes materially and you want
 * everyone to see the new version — that resurrects the card even for
 * leaders who've dismissed the older one.
 */
const DISMISS_KEY = "rota:nephis-notes-dismissed:v1";

type Highlight = {
  title: string;
  body: React.ReactNode;
};

const HIGHLIGHTS: Highlight[] = [
  {
    title: "Recent Updates",
    body: "Every speaker reply — text or web — lands here within seconds. Tap any row to jump to that meeting.",
  },
  {
    title: "One-tap texts",
    body: "Send invitations and reminders straight from your phone's Messages app. The speaker sees the text from your number, and their reply lands in your usual thread.",
  },
  {
    title: "Speaker-declines-with-reason",
    body: 'When a speaker declines, they can add a short note ("out of town", "not feeling well") — you\'ll see it in the bell and next to the declined slot.',
  },
  {
    title: "Weekly Monday check-in",
    body: "Monday evening the bell will summarize this Sunday's speaker slate (confirmed / awaiting / declined) so you always know where you stand.",
  },
  {
    title: "Pull to refresh",
    body: "Tug down at the top of any page to reload — the same gesture as Safari, but works inside the installed app too.",
  },
];

export function NephisNote() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    // Read on mount so the SSR pass doesn't flash. `null` means "not
    // decided yet, don't render"; we flip to true/false after checking.
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore — worst case the card comes back on next load.
    }
  }

  if (dismissed !== false) return null;

  return (
    <div className="relative rounded-xl bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-200 dark:ring-amber-900 p-4 pr-10 shadow-sm">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss Nephi's Notes"
        className="absolute top-2 right-2 rounded-md p-1 text-amber-700/70 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300/70 dark:hover:text-amber-100 dark:hover:bg-amber-900/50"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
          <BookOpen className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest font-bold text-amber-800 dark:text-amber-300">
            Nephi&rsquo;s Notes
          </div>
          <div className="text-sm font-semibold text-amber-900 dark:text-amber-100 mt-0.5">
            A quick tour of what&rsquo;s new
          </div>
          <ul className="mt-3 space-y-2">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="text-sm text-amber-900 dark:text-amber-100 leading-snug">
                <span className="font-semibold">{h.title}. </span>
                <span className="text-amber-900/85 dark:text-amber-100/85">
                  {h.body}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact inline variant — a single-line tip pinned near a specific UI
 * element (e.g. "this button only appears for this week's meeting").
 * Each instance has its own localStorage key, so dismissing one tip
 * doesn't dismiss the others.
 */
export function NephisTip({
  storageKey,
  children,
}: {
  storageKey: string;
  children: React.ReactNode;
}) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const fullKey = `rota:nephis-tip:${storageKey}`;

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(fullKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [fullKey]);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(fullKey, "1");
    } catch {
      // ignore
    }
  }

  if (dismissed !== false) return null;

  return (
    <div className="relative flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-200 dark:ring-amber-900 px-3 py-2 pr-8 text-xs">
      <BookOpen className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <span className="font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider text-[10px]">
          Nephi&rsquo;s Note ·{" "}
        </span>
        <span className="text-amber-900 dark:text-amber-100 leading-snug">
          {children}
        </span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss this note"
        className="absolute top-1 right-1 rounded p-0.5 text-amber-700/70 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300/70 dark:hover:text-amber-100 dark:hover:bg-amber-900/50"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
