import Link from "next/link";
import { BrandStack } from "@/components/brand-mark";
import { InstallPrompt } from "@/components/install-prompt";
import { APP_VERSION } from "@/lib/version";
import { CalendarDays } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Home — Rameumptom" };

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center text-center gap-8 py-8">
      <BrandStack className="text-primary" />
      <p className="max-w-sm text-muted-foreground text-base px-4">
        Plan, share, and run your sacrament meetings from the high stand.
      </p>

      <Link
        href="/"
        className={cn(buttonVariants({ size: "lg" }), "gap-2")}
      >
        <CalendarDays className="w-5 h-5" />
        Upcoming meetings
      </Link>

      <div className="w-full max-w-sm px-4">
        <InstallPrompt />
      </div>

      <p className="text-xs text-muted-foreground/70 mt-auto pt-4">
        v{APP_VERSION}
      </p>
    </div>
  );
}
