"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Card with a bold title that toggles its content open/closed when tapped.
 * Use in place of <Card><CardHeader><CardTitle/></CardHeader><CardContent/></Card>
 * for any program-editor section that should be collapsible.
 */
export function CollapsibleCard({
  title,
  description,
  defaultOpen = true,
  contentClassName,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  defaultOpen?: boolean;
  contentClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="cursor-pointer select-none"
        aria-expanded={open}
      >
        <CardTitle className="text-base font-bold flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1">{title}</span>
          <ChevronDown
            className={cn(
              "w-4 h-4 shrink-0 transition-transform",
              open ? "rotate-180" : "rotate-0",
            )}
          />
        </CardTitle>
        {description && open && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      {open && (
        <CardContent className={contentClassName}>{children}</CardContent>
      )}
    </Card>
  );
}
