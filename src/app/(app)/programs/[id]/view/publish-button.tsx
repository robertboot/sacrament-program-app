"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Globe, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setProgramStatus } from "@/app/(app)/programs/[id]/actions";

/**
 * Publish / Unpublish button for the Conductor view toolbar. Bishopric-only;
 * gated by the same 6-day publishing window the editor enforces (server
 * action rejects earlier attempts too).
 */
export function PublishButton({
  programId,
  status,
  canPublish,
  publishOpensDate,
}: {
  programId: string;
  status: "draft" | "published";
  canPublish: boolean;
  publishOpensDate: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (status === "draft") {
    return (
      <Button
        size="sm"
        onClick={() =>
          start(async () => {
            const r = await setProgramStatus(programId, "published");
            if (r.error) {
              toast.error(r.error);
              return;
            }
            toast.success("Program published.");
            router.refresh();
          })
        }
        disabled={pending || !canPublish}
        title={
          canPublish
            ? undefined
            : `Publishing opens ${publishOpensDate} (6 days before the meeting).`
        }
      >
        <Globe className="w-4 h-4" /> Publish
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() =>
        start(async () => {
          const r = await setProgramStatus(programId, "draft");
          if (r.error) {
            toast.error(r.error);
            return;
          }
          toast.success("Reverted to draft.");
          router.refresh();
        })
      }
      disabled={pending}
    >
      <Globe2 className="w-4 h-4" /> Unpublish
    </Button>
  );
}
