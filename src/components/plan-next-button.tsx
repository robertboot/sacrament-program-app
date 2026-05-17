"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { planNextSunday } from "@/app/(app)/actions";

/**
 * Full-width button under the planner list that creates the next
 * un-started Sunday program and jumps straight into its editor.
 */
export function PlanNextButton() {
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
