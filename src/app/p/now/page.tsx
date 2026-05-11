import { format } from "date-fns";
import { createServiceClient } from "@/lib/supabase/server";
import { renderPublishedProgramByToken } from "../_lib/render-published";

export const dynamic = "force-dynamic"; // always fetch latest — no caching

/**
 * Always-current public share link. Resolves to the closest upcoming
 * published program (today or future). Share this URL once and the rendered
 * page automatically advances week-to-week as the bishop publishes each new
 * Sunday's program.
 */
export default async function CurrentPublicShare() {
  const supabase = createServiceClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: program } = await supabase
    .from("programs")
    .select("share_token")
    .eq("status", "published")
    .gte("meeting_date", today)
    .order("meeting_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!program) {
    const { data: settings } = await supabase
      .from("app_settings")
      .select("branch_name")
      .eq("id", 1)
      .single();
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-zinc-100">
        <div className="max-w-md text-center space-y-3 bg-white p-8 rounded shadow">
          <h1 className="text-xl font-semibold">{settings?.branch_name ?? "Branch"}</h1>
          <p className="text-sm text-muted-foreground">
            No published program for the upcoming Sunday yet. Check back later.
          </p>
        </div>
      </main>
    );
  }

  return await renderPublishedProgramByToken(program.share_token);
}
