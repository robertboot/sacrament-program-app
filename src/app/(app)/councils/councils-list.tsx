"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/collapsible-card";
import { createCouncilMeeting, deleteCouncilMeeting } from "./actions";
import type { CouncilKind, CouncilMeeting } from "@/lib/supabase/types";

const KIND_LABEL: Record<CouncilKind, string> = {
  branch_council: "Branch Council",
  byc: "BYC",
};

export function CouncilsList({ meetings }: { meetings: CouncilMeeting[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function create(kind: CouncilKind) {
    start(async () => {
      const r = await createCouncilMeeting({ kind });
      if (r.error || !r.id) {
        toast.error(r.error ?? "Failed to create meeting.");
        return;
      }
      router.push(`/councils/${r.id}`);
    });
  }

  const bc = meetings.filter((m) => m.kind === "branch_council");
  const byc = meetings.filter((m) => m.kind === "byc");

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Councils</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Build and print Branch Council and BYC agendas. Each meeting
          gets a shareable link your council members can open on their phone.
        </p>
      </div>

      <KindSection
        title={KIND_LABEL.branch_council}
        subtitle="2nd and 4th Sundays, 9:00 AM"
        meetings={bc}
        onCreate={() => create("branch_council")}
        onDelete={(id) =>
          start(async () => {
            if (!confirm("Delete this agenda? This cannot be undone.")) return;
            const r = await deleteCouncilMeeting(id);
            if (r.error) toast.error(r.error);
            else router.refresh();
          })
        }
        pending={pending}
      />

      <KindSection
        title={KIND_LABEL.byc}
        subtitle="Monthly, Sunday before the 3rd-Wednesday combined activity"
        meetings={byc}
        onCreate={() => create("byc")}
        onDelete={(id) =>
          start(async () => {
            if (!confirm("Delete this agenda? This cannot be undone.")) return;
            const r = await deleteCouncilMeeting(id);
            if (r.error) toast.error(r.error);
            else router.refresh();
          })
        }
        pending={pending}
      />
    </div>
  );
}

function KindSection({
  title,
  subtitle,
  meetings,
  onCreate,
  onDelete,
  pending,
}: {
  title: string;
  subtitle: string;
  meetings: CouncilMeeting[];
  onCreate: () => void;
  onDelete: (id: string) => void;
  pending: boolean;
}) {
  return (
    <CollapsibleCard
      title={`${title} (${meetings.length})`}
      description={subtitle}
      defaultOpen
      contentClassName="space-y-2"
    >
      <div>
        <Button onClick={onCreate} disabled={pending}>
          <Plus className="w-4 h-4" /> New agenda
        </Button>
      </div>
      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">
          No agendas yet.
        </p>
      ) : (
        <ul className="divide-y border rounded-md">
          {meetings.map((m) => (
            <li key={m.id} className="px-3 py-2 flex items-center gap-3">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <Link
                href={`/councils/${m.id}`}
                className="flex-1 min-w-0 hover:underline"
              >
                <div className="text-sm font-medium">
                  {formatDateLong(m.meeting_date)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {m.status === "finalized" ? "Finalized" : "Draft"}
                </div>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(m.id)}
                disabled={pending}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </CollapsibleCard>
  );
}

function formatDateLong(iso: string): string {
  const [y, mo, da] = iso.split("-").map(Number);
  return new Date(y, mo - 1, da).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
