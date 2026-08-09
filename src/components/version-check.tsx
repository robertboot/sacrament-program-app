"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Client-side new-version detector. Polls /api/version every few
 * minutes (and on tab-refocus) and compares the returned SHA against
 * the SHA embedded in the client bundle at build time. On mismatch we
 * flip a banner at the top of the screen offering a one-tap reload.
 *
 * Nothing about this depends on pull-to-refresh, PWA cache clearing,
 * or the user reinstalling the app — the banner appears the next
 * time the still-running client polls, even if the launched HTML is
 * an old cached copy.
 */
const POLL_MS = 5 * 60 * 1000; // every 5 minutes while the tab is visible

export function VersionCheck() {
  // "dev" is our locally-built fallback (see src/lib/version.ts).
  // If we don't have a real SHA at build time, don't bother polling.
  const buildSha = process.env.NEXT_PUBLIC_COMMIT_SHA;
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    if (!buildSha) return;
    let cancelled = false;

    async function check() {
      if (cancelled) return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { sha } = (await res.json()) as { sha?: string };
        if (!sha || sha === "dev") return;
        if (sha !== buildSha) {
          if (!cancelled) setOutdated(true);
        }
      } catch {
        // network hiccup; try again next tick.
      }
    }

    check();
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      check();
    }, POLL_MS);
    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [buildSha]);

  if (!outdated) return null;

  return (
    <div
      role="status"
      className="fixed left-1/2 -translate-x-1/2 z-[70] pointer-events-auto"
      style={{ top: `max(env(safe-area-inset-top), 8px)` }}
    >
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-black/10 px-4 py-2 text-sm font-semibold hover:opacity-90"
      >
        <RefreshCw className="w-4 h-4" />
        New version available &mdash; tap to reload
      </button>
    </div>
  );
}
