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
import { createClient } from "@/lib/supabase/server";
import { getEffectiveToday } from "@/lib/effective-today";
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
  //
  // "today" honors the Advance-to-next-Sunday override so both this
  // page and the Planner roll together the moment a leader taps Advance.
  const { today } = await getEffectiveToday();
  const [
    { data: profile },
    { data: nextProgram },
    { data: nextPublished },
  ] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).single(),
    supabase
      .from("programs")
      .select(
        `id, meeting_date, meeting_type, status,
         opening_hymn_id, sacrament_hymn_id, closing_hymn_id,
         opening_hymn_text, sacrament_hymn_text, closing_hymn_text,
         invocation, benediction, stake_business,
         ward_business_releases, ward_business_sustainings,
         ward_business_move_in_welcomes, ward_business_aaronic_sustainings,
         ward_business_baptism_confirmation, ward_business_baby_blessing,
         assignments:speaking_assignments(id, status, speaker_id, custom_speaker_name, reminded_at)`,
      )
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

  // Build a small "still to enter" checklist for the featured Home
  // button, so bishopric see at a glance what's still holding the
  // program back from being publish-ready. Fast-Sunday and no-services
  // meetings skip the speakers/hymns checks (no speakers or hymns are
  // required in those cases).
  type Missing = string[];
  const missing: Missing = [];
  if (isBishopric && nextProgram) {
    const p = nextProgram as unknown as {
      meeting_type: "regular" | "fast_sunday" | "no_services";
      opening_hymn_id: number | null;
      sacrament_hymn_id: number | null;
      closing_hymn_id: number | null;
      opening_hymn_text: string | null;
      sacrament_hymn_text: string | null;
      closing_hymn_text: string | null;
      invocation: string | null;
      benediction: string | null;
      stake_business: string | null;
      ward_business_releases: boolean;
      ward_business_sustainings: boolean;
      ward_business_move_in_welcomes: boolean;
      ward_business_aaronic_sustainings: boolean;
      ward_business_baptism_confirmation: boolean;
      ward_business_baby_blessing: boolean;
      assignments: {
        status: "not_yet_asked" | "awaiting_confirmation" | "confirmed" | "declined";
        speaker_id: string | null;
        custom_speaker_name: string | null;
        reminded_at: string | null;
      }[];
    };
    const isFast = p.meeting_type === "fast_sunday";
    const isNoSvcs = p.meeting_type === "no_services";
    if (!isNoSvcs) {
      if (!isFast) {
        const filled = (p.assignments ?? []).filter(
          (a) => !!a.speaker_id || !!a.custom_speaker_name,
        ).length;
        if (filled < 3) missing.push("Speakers");
        // Any confirmed speaker who hasn't been reminded yet counts as a
        // still-to-do so the leader can see at a glance that Sunday's
        // reminders aren't all out yet.
        const unreminded = (p.assignments ?? []).filter(
          (a) => a.status === "confirmed" && !a.reminded_at,
        ).length;
        if (unreminded > 0)
          missing.push(
            unreminded === 1
              ? "Speaker reminder (1 remaining)"
              : `Speaker reminders (${unreminded} remaining)`,
          );
      }
      // Each slot counts as filled if either the hymn-catalog id or the
      // manual text is set. Matches the renderer's precedence.
      const openingFilled =
        !!p.opening_hymn_id || !!p.opening_hymn_text?.trim();
      const sacramentFilled =
        !!p.sacrament_hymn_id || !!p.sacrament_hymn_text?.trim();
      const closingFilled =
        !!p.closing_hymn_id || !!p.closing_hymn_text?.trim();
      if (!openingFilled || !sacramentFilled || !closingFilled) {
        missing.push("Hymn selections");
      }
      const invocationBlank =
        !p.invocation?.trim() || /by invitation/i.test(p.invocation);
      const benedictionBlank =
        !p.benediction?.trim() || /by invitation/i.test(p.benediction);
      if (invocationBlank) missing.push("Invocation");
      if (benedictionBlank) missing.push("Benediction");
      const anyBusiness =
        p.ward_business_releases ||
        p.ward_business_sustainings ||
        p.ward_business_move_in_welcomes ||
        p.ward_business_aaronic_sustainings ||
        p.ward_business_baptism_confirmation ||
        p.ward_business_baby_blessing ||
        !!p.stake_business?.trim();
      if (!anyBusiness) missing.push("Branch business");
    }
  }

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
            <>
              <Link
                href={`/programs/${nextProgram.id}/view`}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 w-full px-5 py-4 rounded-xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 ring-1 ring-emerald-300 dark:ring-emerald-900 text-emerald-950 dark:text-emerald-100 text-base font-semibold shadow-sm transition"
              >
                <Eye className="w-5 h-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                <span className="text-left">This Sunday&rsquo;s conductor program</span>
                <ChevronRight className="w-5 h-5 shrink-0 opacity-60" />
              </Link>
              {missing.length > 0 && (
                <div className="rounded-md ring-1 ring-amber-200 dark:ring-amber-900 bg-amber-50/60 dark:bg-amber-950/30 px-3 py-2 text-left">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-amber-800 dark:text-amber-300">
                    Still to enter before publishing
                  </div>
                  <ul className="mt-1 text-sm text-amber-900 dark:text-amber-100 space-y-0.5">
                    {missing.map((m) => (
                      <li key={m} className="flex items-start gap-2">
                        <span className="mt-1 w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
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
