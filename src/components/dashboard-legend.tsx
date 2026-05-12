"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "rameumptom.legend.collapsed";

/**
 * Status-pill color legend. Collapsible — the user's preference is persisted
 * in localStorage so the dashboard remembers it between visits.
 */
export function DashboardLegend({ canEdit }: { canEdit: boolean }) {
  // Default to collapsed on first visit — keeps the dashboard chrome thin.
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setCollapsed(stored === "1");
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }

  return (
    <div className="border rounded-md bg-card shadow-sm text-sm text-muted-foreground">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5"
        aria-expanded={!collapsed}
      >
        <span className="font-medium uppercase tracking-wider">Legend</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform",
            collapsed ? "rotate-0" : "rotate-180",
          )}
        />
      </button>
      {!collapsed && (
        <div className="px-3 pb-2 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-5 h-5 rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-900 dark:bg-zinc-100" />
            Not yet asked
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-5 h-5 rounded-full border border-zinc-300 dark:border-zinc-700 bg-yellow-500" />
            Awaiting confirmation
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-5 h-5 rounded-full border border-zinc-300 dark:border-zinc-700 bg-emerald-500" />
            Confirmed
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-5 h-5 rounded-full border border-zinc-300 dark:border-zinc-700 bg-red-500" />
            Declined
          </span>
          {canEdit && (
            <span className="text-[10px] italic sm:ml-auto">
              tap a dot to advance the status
            </span>
          )}
        </div>
      )}
    </div>
  );
}
