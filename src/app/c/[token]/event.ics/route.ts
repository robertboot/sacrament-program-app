import { createServiceClient } from "@/lib/supabase/server";
import { buildIcs } from "@/lib/ics";

export const dynamic = "force-dynamic";

const SLOT_LABEL: Record<string, string> = {
  first: "First speaker (≈5 min)",
  second: "Second speaker (≈10–15 min)",
  concluding: "Concluding speaker (≈15 min)",
};

type Payload = {
  id: string;
  slot: "first" | "second" | "concluding";
  meeting_date: string;
  speaker_name: string | null;
  topic_title: string | null;
  branch_name: string | null;
  unit_type: "ward" | "branch" | null;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const sb = createServiceClient();
  const { data, error } = await sb.rpc("get_assignment_by_confirm_token", {
    p_token: token,
  });
  if (error || !data) {
    return new Response("Not found", { status: 404 });
  }
  const a = data as Payload;
  const unit = a.unit_type === "ward" ? "ward" : "branch";

  const ics = buildIcs({
    uid: a.id,
    meetingDate: a.meeting_date,
    summary: `Sacrament meeting — speaking assignment`,
    description: [
      `Speaking as: ${SLOT_LABEL[a.slot] ?? a.slot}`,
      a.topic_title ? `Topic: ${a.topic_title}` : null,
      `${a.branch_name ?? unit}`,
    ]
      .filter(Boolean)
      .join("\n"),
    location: a.branch_name ?? undefined,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="sacrament-meeting-${a.meeting_date}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
