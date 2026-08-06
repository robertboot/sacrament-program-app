import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Eye,
  Music2,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { BrandStack } from "@/components/brand-mark";
import { InstallPrompt } from "@/components/install-prompt";
import { APP_VERSION } from "@/lib/version";

export const metadata = { title: "Home — Rota" };

export default async function HomePage() {
  const supabase = await createClient();
  // getClaims verifies the JWT locally, avoiding the Supabase auth
  // round-trip that getUser() incurs.
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  // The next upcoming program (today or future, soonest first) drives the
  // Conductor's-program button. The Public button points at /p/now for the
  // closest upcoming *published* program — if none is published yet, we
  // grey the button out so users don't land on a dead-end page.
  const today = format(new Date(), "yyyy-MM-dd");
  const [
    { data: profile },
    { data: nextProgram },
    { data: nextPublished },
  ] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).single(),
    supabase
      .from("programs")
      .select("id, meeting_date")
      .gte("meeting_date", today)
      .order("meeting_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("programs")
      .select("id")
      .eq("status", "published")
      .gte("meeting_date", today)
      .order("meeting_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  const isBishopric = profile?.role === "bishopric";
  const publicAvailable = !!nextPublished;

  return (
    <div className="min-h-[calc(100vh-10rem)] flex flex-col items-center text-center px-4 pb-6 pt-2">
      <BrandStack className="mt-2 mb-4" />

      <div className="text-muted-foreground text-xs sm:text-sm leading-relaxed max-w-[600px] mx-auto mt-6 px-2">
        <p className="font-bold">Our Vision for this app</p>
        <p className="mt-1">
          To simplify the logistical work of sacrament meeting
          planning&mdash;coordinating speakers, topics, and assignments and
          confirming the schedule with everyone involved&mdash;so that
          bishopric leaders can devote their attention to receiving
          inspiration and enriching the worship experience for all.
        </p>
      </div>

      <div className="w-full max-w-md mt-6 space-y-3">
        {publicAvailable ? (
          <a
            href="/p/now"
            target="_blank"
            rel="noreferrer"
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 w-full px-5 py-4 rounded-xl bg-primary text-primary-foreground text-base font-semibold shadow-sm hover:opacity-90 transition"
          >
            <CalendarDays className="w-5 h-5 shrink-0" />
            <span className="text-left">This Sunday&rsquo;s public program</span>
            <ChevronRight className="w-5 h-5 shrink-0 opacity-80" />
          </a>
        ) : (
          <div>
            <div
              aria-disabled="true"
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 w-full px-5 py-4 rounded-xl bg-muted text-muted-foreground text-base font-semibold shadow-sm opacity-70 cursor-not-allowed"
            >
              <CalendarDays className="w-5 h-5 shrink-0" />
              <span className="text-left">This Sunday&rsquo;s public program</span>
              <ChevronRight className="w-5 h-5 shrink-0 opacity-60" />
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 text-left px-1">
              The public version has yet to be published.
            </p>
          </div>
        )}
        {isBishopric &&
          (nextProgram ? (
            <Link
              href={`/programs/${nextProgram.id}/view`}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 w-full px-5 py-4 rounded-xl bg-card ring-1 ring-foreground/10 text-base font-semibold shadow-sm hover:bg-accent transition"
            >
              <Eye className="w-5 h-5 shrink-0 text-primary" />
              <span className="text-left">This Sunday&rsquo;s conductor program</span>
              <ChevronRight className="w-5 h-5 shrink-0 opacity-60" />
            </Link>
          ) : (
            <div className="w-full px-5 py-4 rounded-xl bg-card ring-1 ring-foreground/10 text-sm text-muted-foreground">
              No upcoming program yet.
            </div>
          ))}
        {!isBishopric && nextProgram && (
          <Link
            href={`/programs/${nextProgram.id}`}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 w-full px-5 py-4 rounded-xl bg-card ring-1 ring-foreground/10 text-base font-semibold shadow-sm hover:bg-accent transition"
          >
            <Music2 className="w-5 h-5 shrink-0 text-primary" />
            <span className="text-left">Edit this Sunday&rsquo;s music</span>
            <ChevronRight className="w-5 h-5 shrink-0 opacity-60" />
          </Link>
        )}
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
