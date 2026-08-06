"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateDeclineReason } from "./actions";

/**
 * Shown after a speaker has declined. If they already sent a reason, we
 * echo it back so they know it landed. If they haven't, we offer a small
 * textarea + Send so they can add one without having to go find the
 * bishopric separately. Either way it's optional — nothing else on the
 * page changes based on this.
 */
export function DeclineReasonAddon({
  token,
  existingReason,
}: {
  token: string;
  existingReason: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(existingReason ?? "");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("Please type a reason or tap Cancel.");
      return;
    }
    start(async () => {
      const r = await updateDeclineReason(token, trimmed);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Thanks — the bishopric will see this.");
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (existingReason && !editing) {
    return (
      <div className="rounded-md border bg-zinc-50 dark:bg-zinc-900/50 p-3 text-sm space-y-1">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          Your note to the bishopric
        </div>
        <p className="text-foreground whitespace-pre-wrap">{existingReason}</p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Edit
        </button>
      </div>
    );
  }

  if (!existingReason && !editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 text-center"
      >
        Want to share a reason with the bishopric?
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Out of town that weekend, or feeling unwell…"
        className="text-base"
      />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button onClick={submit} disabled={pending}>
          Send
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setEditing(false);
            setText(existingReason ?? "");
          }}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
