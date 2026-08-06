"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * iOS Safari's native pull-to-refresh only works when the browser
 * chrome is visible. Once the app is added to the home screen and
 * launched as a PWA, that gesture disappears — leaving no way to
 * refresh short of killing the app. This component reintroduces it
 * with a custom touch handler.
 *
 * Behavior:
 *   * only engages when the document is scrolled to the very top
 *   * requires a sustained downward drag past THRESHOLD_PX (about a
 *     third of the way down the screen at typical phone sizes)
 *   * shows a rotating spinner that grows as the user pulls, then
 *     locks solid + spins once the threshold is passed
 *   * on release past threshold, calls location.reload()
 *   * bails out silently if a dialog is open (touch-action:none on
 *     body would swallow the gesture anyway; belt-and-braces)
 */
const THRESHOLD_PX = 90;
const MAX_INDICATOR_PX = 120;

export function PullToRefresh() {
  const startY = useRef<number | null>(null);
  const [pulled, setPulled] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    function isDialogOpen() {
      return !!document.querySelector('[data-slot="dialog-content"][data-open]');
    }

    function onTouchStart(e: TouchEvent) {
      if (refreshing) return;
      if (window.scrollY > 0) return;
      if (isDialogOpen()) return;
      const t = e.touches[0];
      if (!t) return;
      startY.current = t.clientY;
    }

    function onTouchMove(e: TouchEvent) {
      if (refreshing) return;
      if (startY.current === null) return;
      if (window.scrollY > 0) {
        startY.current = null;
        setPulled(0);
        return;
      }
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - startY.current;
      if (dy <= 0) {
        setPulled(0);
        return;
      }
      // Elastic resistance so the indicator eases toward MAX rather
      // than tracking finger movement 1:1 — feels like a native
      // rubber-band pull.
      const eased = Math.min(MAX_INDICATOR_PX, dy * 0.55);
      setPulled(eased);
    }

    function onTouchEnd() {
      if (refreshing) return;
      const past = pulled >= THRESHOLD_PX;
      startY.current = null;
      if (past) {
        setRefreshing(true);
        // A tick of visual feedback before the reload so the user
        // sees the spinner engage.
        window.setTimeout(() => window.location.reload(), 120);
      } else {
        setPulled(0);
      }
    }

    // Passive:true because we only observe; we never preventDefault.
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [pulled, refreshing]);

  const shown = pulled > 4 || refreshing;
  const past = pulled >= THRESHOLD_PX || refreshing;
  const rotation = refreshing ? 0 : Math.min(360, (pulled / THRESHOLD_PX) * 360);

  if (!shown) return null;

  return (
    <div
      aria-hidden
      className="fixed left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
      style={{
        top: `max(env(safe-area-inset-top), 8px)`,
      }}
    >
      <div
        className={`inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-black/10 transition-colors ${past ? "opacity-100" : "opacity-80"}`}
        style={{
          width: 40,
          height: 40,
          transform: `translateY(${Math.max(0, pulled - 20)}px)`,
        }}
      >
        <RefreshCw
          className={refreshing ? "w-5 h-5 animate-spin" : "w-5 h-5"}
          style={refreshing ? undefined : { transform: `rotate(${rotation}deg)` }}
        />
      </div>
    </div>
  );
}
