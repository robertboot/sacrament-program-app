"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { planNextSunday } from "@/app/(app)/actions";

/**
 * Creates the next un-started Sunday program and jumps into its editor.
 * Two presentations:
 *  - variant="bar": full-width button under the planner list
 *  - variant="fab": floating action button pinned bottom-right while on
 *    the planner (sits above the mobile tab bar)
 */
export function PlanNextButton({ variant }: { variant: "bar" | "fab" }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function go() {
    start(async () => {
      const r = await planNextSunday();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (r.id) router.push(`/programs/${r.id}`);
    });
  }

  if (variant === "fab") {
    return (
      <button
        type="button"
        onClick={go}
        disabled={pending}
        aria-label="Plan the next program"
        className="fixed bottom-20 md:bottom-6 right-5 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 active:scale-95 transition disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <Plus className="w-6 h-6" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={pending}
      className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-primary text-primary-foreground text-base font-semibold shadow-sm hover:opacity-90 transition disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Plus className="w-5 h-5" />
      )}
      Plan the next program
    </button>
  );
}
