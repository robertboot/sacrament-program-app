import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";
import type { Profile } from "@/lib/supabase/types";

export const metadata = { title: "Set up your unit — Rameumptom" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // If they already have an active unit, they don't need onboarding. Use
  // maybeSingle() so a missing profile row (signup trigger hasn't fired yet)
  // falls through to the form instead of throwing.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, active_unit_id")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  if (profile?.active_unit_id) redirect("/home");

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Set up your unit
          </h1>
          <p className="text-sm text-muted-foreground">
            One unit per ward or branch. You&rsquo;ll be the first leader and
            can invite others.
          </p>
        </div>
        <OnboardingForm
          defaultName={profile?.full_name ?? ""}
          email={profile?.email ?? user.email ?? ""}
        />
      </div>
    </main>
  );
}
