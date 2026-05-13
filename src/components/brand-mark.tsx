import { cn } from "@/lib/utils";

/**
 * The Rameumptom mark — a trapezoidal pulpit with a thin gold microphone
 * boom reaching up from behind the top. Pulpit takes `currentColor`; the
 * mic uses the brand gold via `accentClassName`.
 */
export function BrandMark({
  className,
  accentClassName = "text-[var(--brand-gold)]",
  showMic = true,
}: {
  className?: string;
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
      {/* Pulpit silhouette */}
      <g fill="currentColor">
        {/* Top horizontal cap — slightly wider than the body */}
        <path d="M 11 19 L 53 19 L 53 23 L 11 23 Z" />
        {/* Body trapezoid (wider at top, narrower at bottom) */}
        <path d="M 14 23 L 50 23 L 46 50 L 18 50 Z" />
        {/* Base platform */}
        <path d="M 9 50 L 55 50 L 54 55 Q 54 57 52 57 L 12 57 Q 10 57 10 55 Z" />
      </g>

      {/* Inset panel on the body — subtle */}
      <path
        d="M 22 28 L 42 28 L 39.5 46 L 24.5 46 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.7"
        opacity="0.18"
      />

      {/* Microphone — stand rises from behind the pulpit top, arches forward */}
      {showMic && (
        <g className={accentClassName}>
          <path
            d="M 32 19 L 32 11 Q 32 7 36 7 L 40 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <ellipse cx="42.5" cy="7" rx="3" ry="2" fill="currentColor" />
        </g>
      )}
    </svg>
  );
}

/**
 * Vertical lockup: large mark above the wordmark. Used on the splash and
 * the auth screens.
 */
export function BrandStack({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex flex-col items-center gap-5", className)}>
      <BrandMark className="w-24 h-24 text-current" />
      <span className="font-semibold tracking-tight text-4xl leading-none">
        Ram
        <span className="text-[var(--brand-gold)]">eum</span>
        ptom
      </span>
    </div>
  );
}

/**
 * Horizontal lockup: mark + wordmark side by side. Used in the top header.
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark className="w-7 h-7 text-current" />
      <span className="font-semibold tracking-tight text-lg leading-none">
        Ram
        <span className="text-[var(--brand-gold)]">eum</span>
        ptom
      </span>
    </span>
  );
}
