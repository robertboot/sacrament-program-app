import { cn } from "@/lib/utils";

/**
 * The Rameumptom pulpit mark — a clean silhouette of a pulpit with an open
 * book on top. Single-color (uses `currentColor` and an optional accent prop
 * for the book) so it adapts to whatever context it's dropped into.
 */
export function BrandMark({
  className,
  accentClassName,
  showBook = true,
}: {
  className?: string;
  /** Tailwind class for the book color, e.g. "text-[--brand-gold]". */
  accentClassName?: string;
  showBook?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-6 h-6", className)}
      aria-hidden
      focusable="false"
    >
      {/* Lectern top — slanted reading surface */}
      <path
        d="M 12 18 L 52 18 L 49 30 L 15 30 Z"
        fill="currentColor"
      />
      {/* Vertical column */}
      <path d="M 26 30 L 38 30 L 36 50 L 28 50 Z" fill="currentColor" />
      {/* Base platform */}
      <path
        d="M 8 50 L 56 50 L 54 56 Q 54 58 52 58 L 12 58 Q 10 58 10 56 Z"
        fill="currentColor"
      />
      {showBook && (
        <g className={accentClassName}>
          {/* Open book on top — left page */}
          <path
            d="M 19 12 L 32 14 L 32 19 L 19 17 Z"
            fill="currentColor"
          />
          {/* Open book on top — right page */}
          <path
            d="M 45 12 L 32 14 L 32 19 L 45 17 Z"
            fill="currentColor"
          />
        </g>
      )}
    </svg>
  );
}
