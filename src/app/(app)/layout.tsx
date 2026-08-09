import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { VersionCheck } from "@/components/version-check";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return (
    <>
      <PullToRefresh />
      <VersionCheck />
      <AppNav role={profile.role} fullName={profile.full_name} />
      <main className="flex-1 mx-auto max-w-5xl w-full px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>
      <MobileTabBar role={profile.role} />
    </>
  );
}
