import { BrandStack } from "@/components/brand-mark";
import { InstallPrompt } from "@/components/install-prompt";
import { APP_VERSION } from "@/lib/version";

export const metadata = { title: "Home — Rameumptom" };

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-10rem)] flex flex-col items-center text-center py-8">
      <div className="flex flex-col items-center gap-8 mt-12 sm:mt-16">
        <BrandStack className="text-primary" />

        <p className="max-w-sm text-muted-foreground text-base px-4">
          Plan, share, and run your sacrament meetings from the high stand.
        </p>
      </div>

      <div className="mt-auto w-full flex flex-col items-center gap-3">
        <div className="w-full max-w-sm px-4">
          <InstallPrompt />
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground/70">v{APP_VERSION}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground/70 mt-2 max-w-sm px-4">
            This is not an official website of The Church of Jesus Christ of
            Latter-day Saints. This site is operated independently by a member
            and does not represent or imply endorsement by the Church.
          </p>
        </div>
      </div>
    </div>
  );
}
