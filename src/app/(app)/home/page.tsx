import { BrandStack } from "@/components/brand-mark";
import { InstallPrompt } from "@/components/install-prompt";
import { APP_VERSION } from "@/lib/version";

export const metadata = { title: "Home — Rameumptom" };

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center text-center gap-8 py-8">
      <div className="bg-primary rounded-2xl px-10 py-8 shadow-sm">
        <BrandStack />
      </div>

      <p className="max-w-sm text-muted-foreground text-base px-4">
        Plan, share, and run your sacrament meetings from the high stand.
      </p>

      <div className="w-full max-w-sm px-4">
        <InstallPrompt />
      </div>

      <div className="mt-auto pt-6 text-center">
        <p className="text-xs text-muted-foreground/70">v{APP_VERSION}</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground/70 mt-2 max-w-sm px-4">
          This is not an official website of The Church of Jesus Christ of
          Latter-day Saints. This site is operated independently by a member
          and does not represent or imply endorsement by the Church.
        </p>
      </div>
    </div>
  );
}
