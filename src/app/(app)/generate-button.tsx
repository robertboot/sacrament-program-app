"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { ensureNextMonthPrograms } from "./actions";

export function GenerateButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      onClick={() =>
        start(async () => {
          const r = await ensureNextMonthPrograms();
          if (r.error) toast.error(r.error);
          else if (r.created === 0)
            toast("Nothing to add — that month is already scheduled.");
          else
            toast.success(
              `Added ${r.created} Sunday${r.created === 1 ? "" : "s"}.`,
            );
        })
      }
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Sparkles className="w-4 h-4" />
      )}
      Generate next month
    </Button>
  );
}
