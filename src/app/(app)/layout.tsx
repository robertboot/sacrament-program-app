import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { loadActiveUnit } from "@/lib/active-unit";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await loadActiveUnit();
  // The proxy already routes signed-in users with no active unit to
  // /onboarding; this is a defensive belt-and-suspenders.
  if (!ctx) redirect("/onboarding");

  // Nav components still take the v1 UserRole vocabulary; "leader" is the
  // v2 equivalent of "bishopric". When we port the nav, we'll switch to
  // MemberRole directly.
  const navRole = ctx.role === "leader" ? "bishopric" : "chorister";

  return (
    <>
      <AppNav role={navRole} fullName={ctx.profile.full_name} />
      <main className="flex-1 mx-auto max-w-5xl w-full px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>
      <MobileTabBar role={navRole} />
    </>
  );
}
