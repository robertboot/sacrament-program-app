"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One collapsible month section on the Planner. The header acts as the
 * toggle; the body holds the Sunday cards. Defaults to closed so the
 * Planner stays focused on the upcoming meeting.
 */
export function DashboardMonthGroup({
  label,
  count,
  defaultOpen = false,
  children,
}: {
  label: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full -mx-4 px-4 py-2.5 bg-background/95 backdrop-blur border-b flex items-center justify-between gap-2 text-left hover:bg-accent/40 transition-colors"
      >
        <span className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
          {label}
        </span>
        <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>
            {count} {count === 1 ? "Sunday" : "Sundays"}
          </span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 transition-transform",
              open ? "rotate-180" : "rotate-0",
            )}
          />
        </span>
      </button>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </section>
  );
}
