import { cn } from "@/lib/utils";

/**
 * The Rameumptom mark — a single curved boom microphone reaching up and
 * to the right. Uses `currentColor` so it adapts to whatever context it
 * is dropped into.
 */
export function BrandMark({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-6 h-6", className)}
      aria-hidden
      focusable="false"
    >
      {/* Curved stand — base at bottom-left, up, then arches over to the right */}
      <path
        d="M 18 56 L 18 24 Q 18 12 30 12 L 42 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Mic head — small flattened oval at the top-right of the arch */}
      <ellipse cx="46" cy="12" rx="6" ry="4" fill="currentColor" />
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
      <BrandMark className="w-20 h-20 text-current" />
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
