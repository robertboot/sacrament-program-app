import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Nephi's Notes" — inline tip callout that highlights a nearby area with
 * a helpful hint. Same slot in the layout as a pro-tip / callout;
 * branded gold treatment so it feels like a first-class piece of the
 * app instead of a stock alert box.
 *
 * Wrap the thing you want to draw attention to in <NephisNote>…</NephisNote>
 * and pass the tip via the `tip` prop. The wrapped children get a gold
 * accent ring so the note visually belongs to them.
 */
export function NephisNote({
  tip,
  children,
  className,
}: {
  tip: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="inline-flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-200 dark:ring-amber-900 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 max-w-full">
        <BookOpen className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest font-bold text-amber-800 dark:text-amber-300 mb-0.5">
            Nephi&rsquo;s Notes
          </div>
          <div className="leading-snug">{tip}</div>
        </div>
      </div>
      <div className="rounded-xl ring-1 ring-amber-200/60 dark:ring-amber-900/50 shadow-sm">
        {children}
      </div>
    </div>
  );
}
