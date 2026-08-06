import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { ConfirmForm } from "./confirm-form";
import { DeclineReasonAddon } from "./decline-reason-addon";

export const dynamic = "force-dynamic";

type AssignmentPayload = {
  id: string;
  slot: "first" | "second" | "concluding";
  length_minutes: number;
  status: "not_yet_asked" | "awaiting_confirmation" | "confirmed" | "declined";
  last_response: "confirmed" | "declined" | null;
  responded_at: string | null;
  /** Optional — only defined after the decline-reason migration is applied. */
  decline_reason?: string | null;
  meeting_date: string;
  speaker_name: string | null;
  topic_title: string | null;
  topic_description: string | null;
  branch_name: string | null;
  unit_type: "ward" | "branch" | null;
};

export default async function PublicConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const sb = createServiceClient();
  const { data, error } = await sb.rpc("get_assignment_by_confirm_token", {
    p_token: token,
  });
  if (error || !data) notFound();
  const a = data as AssignmentPayload;

  const meetingDate = new Date(a.meeting_date + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" },
  );
  const unit = a.unit_type === "ward" ? "ward" : "branch";
  const slotLabel: Record<string, string> = {
    first: "First speaker (≈5 min)",
    second: "Second speaker (≈10–15 min)",
    concluding: "Concluding speaker (≈15 min)",
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-10 flex items-start justify-center">
      <div className="w-full max-w-md space-y-6 bg-white dark:bg-zinc-900 border rounded-xl p-6 shadow-sm">
        <div className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
          {a.branch_name ?? "Sacrament meeting"}
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hi {a.speaker_name ?? "there"} —
          </h1>
          <p className="text-base text-muted-foreground mt-1">
            Would you be willing to speak in our {unit}&rsquo;s sacrament meeting on{" "}
            <span className="font-medium text-foreground">{meetingDate}</span>?
          </p>
        </div>
        <div className="rounded-md border bg-zinc-50 dark:bg-zinc-900/50 p-3 space-y-1">
          <div className="text-sm">
            <span className="text-muted-foreground">Assignment:</span>{" "}
            <span className="font-medium">{slotLabel[a.slot] ?? a.slot}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Topic:</span>{" "}
            <span className="font-medium">{a.topic_title ?? "(to be discussed)"}</span>
          </div>
          {a.topic_description && (
            <p className="text-xs text-muted-foreground italic mt-1">
              {a.topic_description}
            </p>
          )}
        </div>

        {a.last_response ? (
          <>
            <RespondedState response={a.last_response} respondedAt={a.responded_at} />
            {a.last_response === "declined" && (
              <DeclineReasonAddon
                token={token}
                existingReason={a.decline_reason ?? null}
              />
            )}
          </>
        ) : (
          <ConfirmForm token={token} />
        )}

        <AddToCalendar token={token} meetingDate={a.meeting_date} />

        <p className="text-[11px] text-muted-foreground text-center">
          If something is unclear, please reach out to the bishopric directly.
        </p>
      </div>
    </main>
  );
}

function AddToCalendar({
  token,
  meetingDate,
}: {
  token: string;
  meetingDate: string;
}) {
  const [yy, mm, dd] = meetingDate.split("-");
  // Floating local times so the 9 AM lands at 9 AM wherever the recipient is.
  const start = `${yy}${mm}${dd}T090000`;
  const end = `${yy}${mm}${dd}T100000`;
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("Sacrament meeting — speaking assignment")}&dates=${start}/${end}`;
  return (
    <div className="border-t pt-4">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 text-center">
        Add to calendar
      </div>
      <div className="flex flex-wrap justify-center gap-2 text-sm">
        <a
          href={`/c/${token}/event.ics`}
          download
          className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Apple / Outlook (.ics)
        </a>
        <a
          href={gcal}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Google Calendar
        </a>
      </div>
      <p className="text-[11px] text-muted-foreground text-center mt-2">
        Default start time is 9:00 AM. Adjust in your calendar app if your meeting is at a different time.
      </p>
    </div>
  );
}

function RespondedState({
  response,
  respondedAt,
}: {
  response: "confirmed" | "declined";
  respondedAt: string | null;
}) {
  const date = respondedAt
    ? new Date(respondedAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  return (
    <div
      className={
        response === "confirmed"
          ? "rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-900 p-3 text-center"
          : "rounded-md border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-900 p-3 text-center"
      }
    >
      <div className="text-base font-semibold">
        {response === "confirmed"
          ? "Thanks — you're confirmed!"
          : "Got it — we'll find someone else."}
      </div>
      {date && (
        <div className="text-xs text-muted-foreground mt-0.5">Recorded {date}</div>
      )}
    </div>
  );
}
