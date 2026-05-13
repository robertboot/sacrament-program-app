import Link from "next/link";
import { BookOpen, CalendarDays, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/brand-mark";
import { InstallPrompt } from "@/components/install-prompt";
import { APP_VERSION } from "@/lib/version";

export const metadata = { title: "Home — Rameumptom" };

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isBishopric = profile?.role === "bishopric";

  return (
    <div className="min-h-[calc(100vh-10rem)] flex flex-col items-center text-center px-4 pb-6 pt-2">
      <div className="relative mt-2 mb-3 w-44 h-44 flex items-center justify-center">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full bg-amber-100/50 blur-2xl"
        />
        <BrandMark className="relative w-32 h-32 text-primary" />
      </div>

      <h1 className="font-bold tracking-tight text-5xl leading-none">
        Ram
        <span className="text-[var(--brand-gold)]">eum</span>
        ptom
      </h1>

      <div className="relative w-32 my-5">
        <div className="h-px bg-border" />
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[var(--brand-gold)]"
        />
      </div>

      <p className="text-muted-foreground text-base max-w-sm">
        Plan, share, and run your sacrament meetings with ease.
      </p>

      <div className="w-full max-w-md mt-6">
        <InstallPrompt />
      </div>

      {isBishopric && (
        <div className="grid grid-cols-3 gap-3 w-full max-w-md mt-5">
          <QuickCard
            icon={Users}
            title="Speakers"
            desc="View and manage speakers"
            href="/speakers"
          />
          <QuickCard
            icon={BookOpen}
            title="Topics"
            desc="Explore discussion topics"
            href="/topics"
          />
          <QuickCard
            icon={CalendarDays}
            title="Events"
            desc="See upcoming events"
            href="/events"
          />
        </div>
      )}

      <div className="mt-auto pt-8 w-full max-w-md">
        <div className="h-px bg-border" />
        <p className="text-xs text-muted-foreground/70 mt-3">v{APP_VERSION}</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground/70 mt-2 px-2">
          This is not an official website of The Church of Jesus Christ of
          Latter-day Saints. This site is operated independently by a member
          and does not represent or imply endorsement by the Church.
        </p>
      </div>
    </div>
  );
}

function QuickCard({
  icon: Icon,
  title,
  desc,
  href,
}: {
  icon: typeof Users;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center text-center gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10 shadow-sm hover:bg-accent transition-colors"
    >
      <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <div className="font-semibold text-sm leading-tight">{title}</div>
      <div className="text-[11px] text-muted-foreground leading-tight">
        {desc}
      </div>
    </Link>
  );
}
