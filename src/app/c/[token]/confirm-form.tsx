"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { respondToAssignment } from "./actions";
import { toast } from "sonner";

export function ConfirmForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function respond(action: "confirmed" | "declined") {
    start(async () => {
      const r = await respondToAssignment(token, action);
      if (r.error) toast.error(r.error);
      else router.refresh();
    });
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Button
        size="lg"
        className="bg-emerald-600 hover:bg-emerald-700 text-white"
        disabled={pending}
        onClick={() => respond("confirmed")}
      >
        <Check className="w-4 h-4" />
        Yes, I&rsquo;ll speak
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
        disabled={pending}
        onClick={() => respond("declined")}
      >
        <X className="w-4 h-4" />
        Sorry, can&rsquo;t
      </Button>
    </div>
  );
}
