"use client";

import { useEffect, useState } from "react";
import { Check, Share, Smartphone } from "lucide-react";

type Mode = "loading" | "installed" | "ios-safari" | "android" | "desktop";

/**
 * Friendly prompt that explains how to add Rameumptom to the home screen.
 * Detects the running environment and shows the right copy:
 *  - Already installed (standalone) → green confirmation
 *  - iPhone Safari            → step-by-step instructions
 *  - Android/desktop          → native "Add to Home Screen" prompt
 *                               (or generic instructions if unsupported)
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>("loading");
  const [deferred, setDeferred] = useState<
    (Event & { prompt: () => Promise<void> }) | null
  >(null);

  useEffect(() => {
    // Standalone mode (already installed).
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari legacy flag
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setMode("installed");
      return;
    }

    const ua = window.navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);

    if (isIos) {
      setMode("ios-safari");
    } else if (isAndroid) {
      setMode("android");
    } else {
      setMode("desktop");
    }

    // Android Chrome dispatches beforeinstallprompt for a one-tap install.
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as Event & { prompt: () => Promise<void> });
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (mode === "loading") return null;

  if (mode === "installed") {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
        <Check className="w-4 h-4 shrink-0" />
        Installed on your home screen — feels just like an app.
      </div>
    );
  }

  if (mode === "ios-safari") {
    return (
      <div className="rounded-lg border bg-card px-4 py-3 text-sm shadow-sm space-y-2">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Smartphone className="w-4 h-4 text-primary" />
          Add Rameumptom to your home screen
        </div>
        <ol className="text-muted-foreground space-y-1.5 list-decimal pl-5">
          <li>
            Tap the <Share className="inline w-4 h-4 align-text-bottom" /> Share
            icon in Safari&rsquo;s toolbar.
          </li>
          <li>
            Scroll down and tap <span className="font-medium text-foreground">Add to Home Screen</span>.
          </li>
          <li>
            Tap <span className="font-medium text-foreground">Add</span> — the
            pulpit icon will appear on your home screen.
          </li>
        </ol>
        <p className="text-xs text-muted-foreground italic pt-1">
          Opens full-screen with no Safari URL bar — feels like a native app.
        </p>
      </div>
    );
  }

  // Android / desktop: try the native prompt first.
  return (
    <div className="rounded-lg border bg-card px-4 py-3 text-sm shadow-sm space-y-2">
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <Smartphone className="w-4 h-4 text-primary" />
        Install Rameumptom
      </div>
      {deferred ? (
        <>
          <p className="text-muted-foreground">
            Add Rameumptom to your home screen for one-tap access.
          </p>
          <button
            type="button"
            onClick={() => deferred.prompt()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:opacity-90"
          >
            Install
          </button>
        </>
      ) : (
        <p className="text-muted-foreground">
          {mode === "android"
            ? "In Chrome, tap the ⋮ menu and choose Add to Home Screen."
            : "In Chrome/Edge, click the install icon in the address bar to add Rameumptom as an app."}
        </p>
      )}
    </div>
  );
}
