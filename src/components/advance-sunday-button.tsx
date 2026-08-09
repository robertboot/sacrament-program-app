"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FastForward } from "lucide-react";
import { advancePlannerToTomorrow } from "@/app/(app)/actions";

/**
 * "Advance to next Sunday" — shown on the featured Planner card when:
 *   * today is Sunday
 *   * local time is noon or later (sacrament meeting is over)
 *   * the featured meeting_date IS today (so there's something to skip)
 *
 * Tap → sets app_settings.today_override to tomorrow, which shifts
 * every Planner / Home read forward so next Sunday becomes the new
 * upcoming. Shared across the whole bishopric: one leader taps and
 * everyone sees the roll.
 *
 * Time-of-day gate runs client-side so it honors the viewer's local
 * timezone rather than the server's UTC clock.
 */
export function AdvanceSundayButton({
  meetingDate,
}: {
  meetingDate: string;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const now = new Date();
    const isSunday = now.getDay() === 0;
    const isAfterNoon = now.getHours() >= 12;
    const todayIso = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    )
      .toISOString()
      .slice(0, 10);
    setVisible(isSunday && isAfterNoon && meetingDate === todayIso);
  }, [meetingDate]);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-800 dark:text-indigo-200 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 rounded-md px-2.5 py-1.5 border border-indigo-200 dark:border-indigo-900 disabled:opacity-60"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await advancePlannerToTomorrow();
          if (r.error) {
            toast.error(r.error);
            return;
          }
          toast.success("Advanced to next Sunday.");
          router.refresh();
        })
      }
    >
      <FastForward className="w-3.5 h-3.5" />
      {pending ? "Advancing…" : "Advance to next Sunday"}
    </button>
  );
}
