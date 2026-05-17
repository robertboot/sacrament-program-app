"use client";

import { useEffect, useState } from "react";
import { Calendar, ChevronRight, Share } from "lucide-react";

type Mode =
  | "loading"
  | "installed"
  | "ios-safari"
  | "ios-other-browser"
  | "android"
  | "desktop";

/**
 * Friendly prompt that explains how to add Rota to the home screen.
 * Detects the running environment and shows the right copy:
 *  - Already installed (standalone) → green confirmation
 *  - iPhone Safari            → step-by-step instructions
 *  - iPhone Chrome/Firefox/etc → "open this in Safari" — only Safari on iOS
 *                               can actually save to the home screen
 *  - Android/desktop          → native "Add to Home Screen" prompt
 *                               (or generic instructions if unsupported)
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>("loading");
  const [deferred, setDeferred] = useState<
    (Event & { prompt: () => Promise<void> }) | null
  >(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setMode("installed");
      return;
    }

    const ua = window.navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    // On iOS every browser is a WebKit reskin, but only Safari exposes
    // "Add to Home Screen". Chrome/Firefox/Edge announce themselves with
    // CriOS / FxiOS / EdgiOS in the UA; anything else on iOS we treat as
    // Safari.
    const isIosNonSafari =
      isIos && /CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua);

    if (isIosNonSafari) {
      setMode("ios-other-browser");
    } else if (isIos) {
      setMode("ios-safari");
    } else if (isAndroid) {
      setMode("android");
    } else {
      setMode("desktop");
    }

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
      <a
        href="/p/now"
        target="_blank"
        rel="noreferrer"
        className="grid grid-cols-[auto_1fr_auto] items-center gap-3 w-full px-5 py-4 rounded-xl bg-primary text-primary-foreground text-base font-semibold shadow-sm hover:opacity-90 transition"
      >
        <Calendar className="w-5 h-5 shrink-0" />
        <span className="text-left">View this Sunday&rsquo;s Program</span>
        <ChevronRight className="w-5 h-5 shrink-0 opacity-80" />
      </a>
    );
  }

  if (mode === "ios-safari") {
    return (
      <div className="rounded-lg border bg-card px-4 py-3 text-sm shadow-sm space-y-2 text-left">
        <div className="font-semibold text-foreground">
          Add Rota to your home screen
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

  if (mode === "ios-other-browser") {
    return (
      <div className="rounded-lg border bg-card px-4 py-3 text-sm shadow-sm space-y-2 text-left">
        <div className="font-semibold text-foreground">
          Open this page in Safari to install
        </div>
        <p className="text-muted-foreground">
          On iPhone, only Safari can add Rota to your home screen. Tap
          the address bar, copy this URL, then paste it in Safari and use the{" "}
          <Share className="inline w-4 h-4 align-text-bottom" /> Share menu →{" "}
          <span className="font-medium text-foreground">Add to Home Screen</span>.
        </p>
      </div>
    );
  }

  if (mode === "android") {
    return (
      <div className="rounded-lg border bg-card px-4 py-3 text-sm shadow-sm space-y-2 text-left">
        <div className="font-semibold text-foreground">Install Rota</div>
        {deferred ? (
          <>
            <p className="text-muted-foreground">
              Add Rota to your home screen for one-tap access.
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
            In Chrome, tap the <span className="font-medium text-foreground">⋮</span>{" "}
            menu and choose{" "}
            <span className="font-medium text-foreground">Add to Home Screen</span>.
            In Firefox, tap{" "}
            <span className="font-medium text-foreground">⋮ → Install</span>.
          </p>
        )}
      </div>
    );
  }

  // Desktop.
  return (
    <div className="rounded-lg border bg-card px-4 py-3 text-sm shadow-sm space-y-2 text-left">
      <div className="font-semibold text-foreground">Install Rota</div>
      {deferred ? (
        <>
          <p className="text-muted-foreground">
            Add Rota as an app for one-click access.
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
          In Chrome or Edge, click the install icon in the address bar to add
          Rota as an app. In Safari (macOS),{" "}
          <span className="font-medium text-foreground">
            File → Add to Dock
          </span>
          .
        </p>
      )}
    </div>
  );
}
