"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy as CopyIcon,
  Eye,
  History,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Share2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CollapsibleCard } from "@/components/collapsible-card";
import { HymnPicker } from "@/components/hymn-picker";
import { CouncilRender } from "@/components/council-render";
import { CouncilPrintStyles } from "@/components/council-print-styles";
import {
  addAgendaItem,
  copyItemsFromLastMeeting,
  deleteAgendaItem,
  deleteCouncilMeeting,
  refreshBycTheme,
  regenerateCouncilShareToken,
  reorderAgendaItems,
  updateAgendaItem,
  updateCouncilMeeting,
} from "../actions";
import type {
  CouncilAgendaItem,
  CouncilMeeting,
  Hymn,
} from "@/lib/supabase/types";

type Draft = {
  meeting_date: string;
  opening_hymn_id: number | null;
  opening_hymn_text: string | null;
  theme: string;
  theme_pages: string;
  activity_date: string;
  activity_ideas: string;
  looking_ahead_text: string;
  follow_up_text: string;
  post_meeting_notes: string;
};

export function CouncilEditor({
  branchName,
  meeting,
  items: initialItems,
  hymns,
}: {
  branchName: string;
  meeting: CouncilMeeting;
  items: CouncilAgendaItem[];
  hymns: Hymn[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState<CouncilAgendaItem[]>(initialItems);
  const [draft, setDraft] = useState<Draft>({
    meeting_date: meeting.meeting_date,
    opening_hymn_id: meeting.opening_hymn_id,
    opening_hymn_text: meeting.opening_hymn_text,
    theme: meeting.theme ?? "",
    theme_pages: meeting.theme_pages ?? "",
    activity_date: meeting.activity_date ?? "",
    activity_ideas: meeting.activity_ideas ?? "",
    looking_ahead_text: meeting.looking_ahead_text ?? "",
    follow_up_text: meeting.follow_up_text,
    post_meeting_notes: meeting.post_meeting_notes ?? "",
  });

  // Debounced autosave for the meeting-level fields. Debounce lives
  // outside render so re-renders don't reset the timer. The "saving"
  // flag flips inside the user-driven patch() calls (not in the effect
  // body), which keeps React's set-state-in-effect rule quiet.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const r = await updateCouncilMeeting(meeting.id, {
        meeting_date: draft.meeting_date,
        opening_hymn_id: draft.opening_hymn_id,
        opening_hymn_text: draft.opening_hymn_text,
        theme: draft.theme.trim() || null,
        theme_pages: draft.theme_pages.trim() || null,
        activity_date: draft.activity_date || null,
        activity_ideas: draft.activity_ideas.trim() || null,
        looking_ahead_text: draft.looking_ahead_text.trim() || null,
        follow_up_text: draft.follow_up_text,
        post_meeting_notes: draft.post_meeting_notes.trim() || null,
      });
      if (r.error) toast.error(r.error);
      else setSavingState("saved");
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draft.meeting_date,
    draft.opening_hymn_id,
    draft.opening_hymn_text,
    draft.theme,
    draft.theme_pages,
    draft.activity_date,
    draft.activity_ideas,
    draft.looking_ahead_text,
    draft.follow_up_text,
    draft.post_meeting_notes,
  ]);

  const isBc = meeting.kind === "branch_council";
  const titleBase = isBc ? "Branch Council" : "BYC";

  function patch(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
    setSavingState("saving");
  }

  function addItem() {
    start(async () => {
      const r = await addAgendaItem(meeting.id);
      if (r.error || !r.id) {
        toast.error(r.error ?? "Failed to add item.");
        return;
      }
      setItems((cur) => [
        ...cur,
        {
          id: r.id!,
          meeting_id: meeting.id,
          position: cur.length + 1,
          title: "",
          sub_note: null,
          created_at: new Date().toISOString(),
        },
      ]);
    });
  }

  function removeItem(id: string) {
    start(async () => {
      const r = await deleteAgendaItem(id, meeting.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setItems((cur) => cur.filter((it) => it.id !== id));
    });
  }

  function patchItem(id: string, p: { title?: string; sub_note?: string | null }) {
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, ...p } : it)));
    // Fire-and-forget persistence; silent failures only toast an error.
    (async () => {
      const r = await updateAgendaItem(id, p);
      if (r.error) toast.error(r.error);
    })();
  }

  function moveItem(id: string, delta: -1 | 1) {
    setItems((cur) => {
      const idx = cur.findIndex((it) => it.id === id);
      if (idx < 0) return cur;
      const next = idx + delta;
      if (next < 0 || next >= cur.length) return cur;
      const copy = cur.slice();
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      const orderedIds = copy.map((it) => it.id);
      (async () => {
        const r = await reorderAgendaItems(meeting.id, orderedIds);
        if (r.error) toast.error(r.error);
      })();
      return copy.map((it, i) => ({ ...it, position: i + 1 }));
    });
  }

  function copyFromLast() {
    start(async () => {
      const r = await copyItemsFromLastMeeting(meeting.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Copied ${r.copied} item${r.copied === 1 ? "" : "s"}.`);
      router.refresh();
    });
  }

  function refreshTheme() {
    start(async () => {
      const r = await refreshBycTheme(meeting.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (r.hit) toast.success("Theme refreshed from the Church site.");
      else toast.message("No fresh data from the Church site — kept what we had.");
      router.refresh();
    });
  }

  function copyShareLink() {
    const url = `${window.location.origin}/council/${meeting.share_token}`;
    navigator.clipboard?.writeText(url);
    toast.success("Share link copied.");
  }

  function regenerateShareLink() {
    if (!confirm("Regenerate the share link? The old one stops working immediately."))
      return;
    start(async () => {
      const r = await regenerateCouncilShareToken(meeting.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("New share link generated.");
      router.refresh();
    });
  }

  function remove() {
    if (!confirm("Delete this agenda? This cannot be undone.")) return;
    start(async () => {
      const r = await deleteCouncilMeeting(meeting.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      router.push("/councils");
    });
  }

  const renderData = useMemo(
    () => ({
      branchName,
      meeting: {
        ...meeting,
        meeting_date: draft.meeting_date,
        opening_hymn_id: draft.opening_hymn_id,
        opening_hymn_text: draft.opening_hymn_text,
        theme: draft.theme || null,
        theme_pages: draft.theme_pages || null,
        activity_date: draft.activity_date || null,
        activity_ideas: draft.activity_ideas || null,
        looking_ahead_text: draft.looking_ahead_text || null,
        follow_up_text: draft.follow_up_text,
        post_meeting_notes: draft.post_meeting_notes || null,
      },
      items,
      hymn: hymns.find((h) => h.id === draft.opening_hymn_id) ?? null,
    }),
    [branchName, meeting, draft, items, hymns],
  );

  return (
    <div className="space-y-5 pb-20">
      <CouncilPrintStyles kind={meeting.kind} />

      <div className="no-print flex items-center justify-between gap-3">
        <Link
          href="/councils"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Councils
        </Link>
        <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
          {savingState === "saving" ? (
            <>
              <Save className="w-3.5 h-3.5 animate-pulse" /> Saving…
            </>
          ) : savingState === "saved" ? (
            <>
              <Save className="w-3.5 h-3.5" /> Saved
            </>
          ) : null}
        </div>
      </div>

      <div className="no-print">
        <h1 className="text-3xl font-bold tracking-tight">{titleBase} agenda</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Autosaves as you type. Use Print for the one-page (BC) or
          folded-booklet (BYC) print layout. Share link opens a read-only
          view council members can bookmark.
        </p>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="w-4 h-4" /> Print
        </Button>
        <Button variant="outline" onClick={copyShareLink}>
          <Share2 className="w-4 h-4" /> Copy share link
        </Button>
        <Link
          href={`/council/${meeting.share_token}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border bg-background hover:bg-accent text-sm"
        >
          <Eye className="w-4 h-4" /> View shared
        </Link>
        <Button variant="outline" onClick={copyFromLast}>
          <History className="w-4 h-4" /> Pull items from last meeting
        </Button>
        {!isBc && (
          <Button variant="outline" onClick={refreshTheme} disabled={pending}>
            <RefreshCw className="w-4 h-4" /> Refresh theme from FSY
          </Button>
        )}
        <Button variant="ghost" onClick={regenerateShareLink} disabled={pending}>
          <CopyIcon className="w-4 h-4" /> Regenerate link
        </Button>
        <Button variant="ghost" onClick={remove} disabled={pending}>
          <Trash2 className="w-4 h-4" /> Delete
        </Button>
      </div>

      <div className="no-print">
        <CollapsibleCard title="Meeting details" defaultOpen contentClassName="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Meeting date</Label>
              <Input
                id="date"
                type="date"
                value={draft.meeting_date}
                onChange={(e) => patch({ meeting_date: e.target.value })}
              />
            </div>
            {isBc && (
              <div className="space-y-1.5">
                <Label>Opening hymn</Label>
                <HymnPicker
                  hymns={hymns}
                  value={draft.opening_hymn_id}
                  customValue={draft.opening_hymn_text}
                  onChange={(pick) =>
                    patch({
                      opening_hymn_id: pick.hymn_id,
                      opening_hymn_text: pick.custom_hymn_text,
                    })
                  }
                />
              </div>
            )}
          </div>

          {!isBc && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2 rounded-md ring-1 ring-border bg-muted/30 px-3 py-2 text-xs">
                <strong>Auto-filled from the FSY lesson pages for the
                planning month.</strong> &ldquo;Refresh theme from FSY&rdquo;
                re-pulls from the Church site and recomputes the 3rd-Wednesday
                activity date. Edit any field below to override.
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="theme">FSY chapter / theme</Label>
                <Input
                  id="theme"
                  value={draft.theme}
                  onChange={(e) => patch({ theme: e.target.value })}
                  placeholder="e.g. Truth Will Make You Free"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="theme-pages">FSY guide pages</Label>
                <Input
                  id="theme-pages"
                  value={draft.theme_pages}
                  onChange={(e) => patch({ theme_pages: e.target.value })}
                  placeholder="e.g. 50&ndash;56"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="activity-date">Combined activity date</Label>
                <Input
                  id="activity-date"
                  type="date"
                  value={draft.activity_date}
                  onChange={(e) => patch({ activity_date: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">
                  3rd Wednesday of the planning month.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ideas">Magazine activity ideas</Label>
                <Input
                  id="ideas"
                  value={draft.activity_ideas}
                  onChange={(e) => patch({ activity_ideas: e.target.value })}
                  placeholder="e.g. Three Truths and a Lie · Freed by Truth"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="looking-ahead">Looking Ahead (optional)</Label>
                <Textarea
                  id="looking-ahead"
                  rows={2}
                  value={draft.looking_ahead_text}
                  onChange={(e) => patch({ looking_ahead_text: e.target.value })}
                  placeholder="e.g. December theme — &ldquo;Peace in Christ&rdquo; / Activity Wed, Dec 16 — plan at the next BYC"
                />
                <p className="text-[11px] text-muted-foreground">
                  Also auto-filled from next month&rsquo;s FSY lesson.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="follow-up">Follow-up bullets</Label>
            <Textarea
              id="follow-up"
              rows={3}
              value={draft.follow_up_text}
              onChange={(e) => patch({ follow_up_text: e.target.value })}
              placeholder="One bullet per line."
            />
            <p className="text-[11px] text-muted-foreground">
              One bullet per line. Defaults to &ldquo;Review assignments and
              action items&rdquo;; replace for a specific debrief.
            </p>
          </div>
        </CollapsibleCard>
      </div>

      <div className="no-print">
        <CollapsibleCard
          title={isBc ? `Branch Items (${items.length})` : `Extra items (${items.length})`}
          description={
            isBc
              ? undefined
              : "The 5 standard BYC items (theme, activity, spiritual message, assignments, upcoming events) are auto-generated. Add anything else here."
          }
          defaultOpen
          contentClassName="space-y-2"
        >
          <div>
            <Button onClick={addItem} disabled={pending}>
              <Plus className="w-4 h-4" /> Add item
            </Button>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              {isBc ? "No items yet." : "No extra items — the standard 5 are enough."}
            </p>
          ) : (
            <ol className="space-y-2">
              {items.map((it, i) => (
                <li
                  key={it.id}
                  className="rounded-md ring-1 ring-border bg-card p-3 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-semibold w-5 text-right pt-2">
                      {i + 1}.
                    </span>
                    <div className="flex-1 min-w-0 space-y-2">
                      <Input
                        value={it.title}
                        onChange={(e) =>
                          patchItem(it.id, { title: e.target.value })
                        }
                        placeholder="Item — short descriptor"
                      />
                      <Textarea
                        rows={2}
                        value={it.sub_note ?? ""}
                        onChange={(e) =>
                          patchItem(it.id, {
                            sub_note: e.target.value || null,
                          })
                        }
                        placeholder="Sub-note (specifics, names, questions to resolve)"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveItem(it.id, -1)}
                        disabled={i === 0}
                        aria-label="Move up"
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveItem(it.id, 1)}
                        disabled={i === items.length - 1}
                        aria-label="Move down"
                      >
                        ↓
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(it.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CollapsibleCard>
      </div>

      <div className="no-print">
        <CollapsibleCard
          title="Post-meeting notes"
          description="Hidden from the printed agenda. For your own record."
          defaultOpen={false}
          contentClassName="space-y-2"
        >
          <Textarea
            rows={5}
            value={draft.post_meeting_notes}
            onChange={(e) => patch({ post_meeting_notes: e.target.value })}
            placeholder="Decisions, action items, who said they'd follow up on what…"
          />
        </CollapsibleCard>
      </div>

      <div className="no-print rounded-md ring-1 ring-border bg-card overflow-hidden">
        <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b">
          Preview
        </div>
        <div className="p-2 bg-[#f8fafc]">
          <CouncilRender {...renderData} />
        </div>
      </div>

      {/* Print-only: the real agenda, no editor chrome. */}
      <div className="print-only hidden print:block">
        <CouncilRender {...renderData} />
      </div>
    </div>
  );
}

