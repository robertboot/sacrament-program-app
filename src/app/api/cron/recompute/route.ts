import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Vercel Cron hits this once a day to advance rotation dates past meetings.
// Configure schedule in vercel.json. Secret via CRON_SECRET env (optional but recommended).
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { error: e1 } = await supabase.rpc("recompute_all_rotation_dates");
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
