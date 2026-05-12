import { cn } from "@/lib/utils";

/**
 * The Rameumptom pulpit mark — a clean silhouette of a lectern with a thin
 * microphone reaching over the top and an inset panel on the front face.
 * Single-color via `currentColor` so it adapts to whatever context it's
 * dropped into.
 */
export function BrandMark({
  className,
  accentClassName,
  showMic = true,
}: {
  className?: string;
  /** Tailwind class for the microphone color, e.g. "text-[--brand-gold]". */
  accentClassName?: string;
  showMic?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-6 h-6", className)}
      aria-hidden
      focusable="false"
    >
      {/* Pulpit silhouette (currentColor) */}
      <g fill="currentColor">
        {/* Top lectern surface — slight extension wider than body */}
        <path d="M 11 18 L 53 18 L 53 23 L 11 23 Z" />
        {/* Body — trapezoid (wider at top, narrower at bottom) */}
        <path d="M 14 23 L 50 23 L 46 50 L 18 50 Z" />
        {/* Base platform */}
        <path d="M 9 50 L 55 50 L 53 56 Q 53 58 51 58 L 13 58 Q 11 58 11 56 Z" />
      </g>

      {/* Inset panel detail on the body (background-cut) */}
      <path
        d="M 22 28 L 42 28 L 39.5 46 L 24.5 46 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.18"
      />

      {/* Microphone — bent stand reaching up and forward */}
      {showMic && (
        <g className={accentClassName}>
          <path
            d="M 32 18 L 32 12 Q 32 9 35 9 L 39 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="40.5" cy="9" r="2" fill="currentColor" />
        </g>
      )}
    </svg>
  );
}

/**
 * Horizontal logo lockup: pulpit mark + "Rameumptom" wordmark with the
 * accent "eu" in the brand gold. Used in the top header.
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark
        className="w-7 h-7 text-current"
        accentClassName="text-[var(--brand-gold)]"
      />
      <span className="font-semibold tracking-tight text-lg leading-none">
        Ram
        <span className="text-[var(--brand-gold)]">eu</span>
        mptom
      </span>
    </span>
  );
}
