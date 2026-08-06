"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, X } from "lucide-react";
import { respondToAssignment } from "./actions";
import { toast } from "sonner";

export function ConfirmForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Reveal-on-decline: tapping "Sorry, can't" doesn't fire the request
  // straight away — it opens a small reason textarea + Send / Skip
  // buttons. Speakers who don't want to explain can hit Skip and it
  // records the decline with no reason (unchanged from the old flow).
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");

  function confirm() {
    start(async () => {
      const r = await respondToAssignment(token, "confirmed");
      if (r.error) toast.error(r.error);
      else router.refresh();
    });
  }

  function submitDecline(withReason: boolean) {
    start(async () => {
      const r = await respondToAssignment(
        token,
        "declined",
        withReason ? reason : null,
      );
      if (r.error) toast.error(r.error);
      else router.refresh();
    });
  }

  if (declineOpen) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          No problem. If you&rsquo;d like the bishopric to know why, share a
          quick note — otherwise tap Skip and we&rsquo;ll find someone else.
        </p>
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Out of town that weekend, or feeling unwell…"
          className="text-base"
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <Button
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={pending}
            onClick={() => submitDecline(!!reason.trim())}
          >
            {reason.trim() ? "Send reason & decline" : "Decline without a reason"}
          </Button>
          <Button
            size="lg"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setDeclineOpen(false);
              setReason("");
            }}
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Button
        size="lg"
        className="bg-emerald-600 hover:bg-emerald-700 text-white"
        disabled={pending}
        onClick={confirm}
      >
        <Check className="w-4 h-4" />
        Yes, I&rsquo;ll speak
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
        disabled={pending}
        onClick={() => setDeclineOpen(true)}
      >
        <X className="w-4 h-4" />
        Sorry, can&rsquo;t
      </Button>
    </div>
  );
}
