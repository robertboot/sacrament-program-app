import "server-only";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";

/**
 * The "today" the Planner / Home should use when deciding which
 * program is upcoming. Normally today's actual date, but if a
 * bishopric member tapped "Advance to next Sunday" on a Sunday
 * afternoon, app_settings.today_override is set to tomorrow, and
 * that wins — so this Sunday's meeting drops out of "upcoming"
 * and next Sunday takes its place.
 *
 * Semantics: max(current_date, today_override). Once the real
 * date catches up, the override becomes a no-op automatically —
 * no cleanup needed.
 *
 * Also returns whether an override is currently in effect so the
 * UI can (if it wants) show that state distinctly.
 */
export async function getEffectiveToday(): Promise<{
  today: string;
  overrideActive: boolean;
}> {
  const supabase = await createClient();
  const actualToday = format(new Date(), "yyyy-MM-dd");
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("today_override")
      .eq("id", 1)
      .maybeSingle();
    const override = (data as { today_override?: string | null } | null)
      ?.today_override;
    if (override && override > actualToday) {
      return { today: override, overrideActive: true };
    }
  } catch {
    // pre-migration DB — fall through to actual today.
  }
  return { today: actualToday, overrideActive: false };
}
