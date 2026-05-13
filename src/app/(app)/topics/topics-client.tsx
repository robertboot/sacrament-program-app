"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Upload,
  Pencil,
  Info,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { weeksSinceLabel } from "@/lib/dates";
import type { SpeakerCategory, Topic } from "@/lib/supabase/types";
import { createTopic, updateTopic, deleteTopic, bulkImportTopics } from "./actions";
import { cn } from "@/lib/utils";

type CategoryFilter = "all" | "first" | "long";

const FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "first", label: "5 min subjects" },
  { value: "long", label: "10 & 15 min subjects" },
];

type TopicGroup = "5min" | "10_15min";

const GROUP_OPTIONS: { value: TopicGroup; label: string }[] = [
  { value: "5min", label: "5 min subject" },
  { value: "10_15min", label: "10–15 min subject" },
];

const GROUP_TO_CATEGORIES: Record<TopicGroup, SpeakerCategory[]> = {
  "5min": ["first"],
  "10_15min": ["second", "concluding"],
};

function detectGroup(categories: SpeakerCategory[] | undefined): TopicGroup | null {
  const cats = categories ?? [];
  if (cats.length === 0) return null;
  // Treat presence of either "second" or "concluding" as the long group, since
  // those topics are interchangeable between the 10- and 15-min slots.
  if (cats.includes("second") || cats.includes("concluding")) return "10_15min";
  if (cats.includes("first")) return "5min";
  return null;
}

function badgeFor(group: TopicGroup): string {
  return group === "5min" ? "5 min" : "10–15 min";
}

export function TopicsClient({ initialTopics }: { initialTopics: Topic[] }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [editing, setEditing] = useState<Topic | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialTopics.filter((t) => {
      if (
        q &&
        !t.title.toLowerCase().includes(q) &&
        !(t.description ?? "").toLowerCase().includes(q)
      )
        return false;
      const cats = t.categories ?? [];
      if (categoryFilter === "first" && !cats.includes("first")) return false;
      if (
        categoryFilter === "long" &&
        !cats.includes("second") &&
        !cats.includes("concluding")
      )
        return false;
      return true;
    });
  }, [search, categoryFilter, initialTopics]);

  const active = filtered.filter((t) => t.is_active);
  const inactive = filtered.filter((t) => !t.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">Topics</h1>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>{active.length} active</span>
            <span aria-hidden>·</span>
            <span>Rotation picks the longest-unused</span>
            <Popover>
              <PopoverTrigger
                aria-label="How does the topic rotation work?"
                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              >
                <Info className="w-3.5 h-3.5" />
              </PopoverTrigger>
              <PopoverContent className="text-xs w-64">
                Topics with the longest gap since they were last used float to
                the top of the rotation. The topic picker uses the same order.
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <Button onClick={() => setShowAdd(true)} className="shrink-0">
          <Plus className="w-4 h-4" />
          Add topic
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search topics by title or description…"
          className="pl-12 h-12 rounded-xl bg-card text-base"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            type="button"
            size="sm"
            variant={categoryFilter === f.value ? "default" : "outline"}
            className={cn(
              "rounded-lg",
              categoryFilter !== f.value && "bg-card",
            )}
            onClick={() => setCategoryFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More topic actions"
            className="ml-auto inline-flex items-center justify-center rounded-lg bg-card h-7 w-7 ring-1 ring-border hover:bg-muted"
          >
            <MoreVertical className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowImport(true)}>
              <Upload className="w-4 h-4" />
              Bulk import
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2">
        {active.map((t) => (
          <TopicRow key={t.id} topic={t} onEdit={() => setEditing(t)} />
        ))}
      </div>

      {inactive.length > 0 && (
        <details className="mt-6">
          <summary className="text-sm text-muted-foreground cursor-pointer">
            Inactive ({inactive.length})
          </summary>
          <div className="space-y-2 mt-2">
            {inactive.map((t) => (
              <TopicRow key={t.id} topic={t} onEdit={() => setEditing(t)} />
            ))}
          </div>
        </details>
      )}

      <TopicDialog
        open={showAdd || !!editing}
        topic={editing}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
      />
      <BulkImportDialog open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}

function TopicRow({ topic, onEdit }: { topic: Topic; onEdit: () => void }) {
  const group = detectGroup(topic.categories);
  return (
    <Card className="py-0">
      <CardContent className="p-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium flex items-center gap-2 flex-wrap">
            {topic.title}
            {!topic.is_active && (
              <Badge variant="outline" className="text-[10px]">
                inactive
              </Badge>
            )}
            {group && (
              <Badge variant="secondary" className="text-[10px]">
                {badgeFor(group)}
              </Badge>
            )}
          </div>
          {topic.description && (
            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {topic.description}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-1">
            Last used: {weeksSinceLabel(topic.last_used_date)}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function TopicDialog({
  open,
  topic,
  onClose,
}: {
  open: boolean;
  topic: Topic | null;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(topic?.title ?? "");
  const [description, setDescription] = useState(topic?.description ?? "");
  const [isActive, setIsActive] = useState(topic?.is_active ?? true);
  const [group, setGroup] = useState<TopicGroup | null>(detectGroup(topic?.categories));
  const [trackedId, setTrackedId] = useState(topic?.id);
  if (topic?.id !== trackedId) {
    setTrackedId(topic?.id);
    setTitle(topic?.title ?? "");
    setDescription(topic?.description ?? "");
    setIsActive(topic?.is_active ?? true);
    setGroup(detectGroup(topic?.categories));
  }

  function onSubmit() {
    if (!group) return;
    start(async () => {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        is_active: isActive,
        categories: GROUP_TO_CATEGORIES[group],
      };
      const r = topic
        ? await updateTopic(topic.id, payload)
        : await createTopic(payload);
      if (r.error) toast.error(r.error);
      else {
        toast.success(topic ? "Topic updated." : "Topic added.");
        onClose();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{topic ? "Edit topic" : "Add topic"}</DialogTitle>
          <DialogDescription>
            Last used: {weeksSinceLabel(topic?.last_used_date ?? null)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              rows={4}
              placeholder="Suggested scriptures, talk references, or guidance for the speaker…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Type <span className="text-red-600">*</span>
            </Label>
            <div className="flex gap-2 flex-wrap">
              {GROUP_OPTIONS.map((g) => {
                const on = group === g.value;
                return (
                  <Button
                    key={g.value}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    onClick={() => setGroup(g.value)}
                  >
                    {g.label}
                  </Button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              5 min subjects are usually simpler and aimed at youth or new members. 10 &amp;
              15 min topics are interchangeable between the second and concluding slots.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="active"
              checked={isActive}
              onCheckedChange={(v) => setIsActive(v === true)}
            />
            <Label htmlFor="active" className="cursor-pointer">
              Active (eligible for rotation)
            </Label>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {topic && (
            <Button
              variant="outline"
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950 mr-auto"
              onClick={() => {
                if (
                  !confirm(
                    `Delete "${topic.title}" permanently? Past programs that used this topic will show "—" in its place. To pause it without losing history, uncheck Active instead.`,
                  )
                )
                  return;
                start(async () => {
                  const r = await deleteTopic(topic.id);
                  if (r.error) toast.error(r.error);
                  else {
                    toast.success("Topic deleted.");
                    onClose();
                  }
                });
              }}
              disabled={pending}
            >
              Delete topic
            </Button>
          )}
          <Button onClick={onSubmit} disabled={pending || !title.trim() || !group}>
            {topic ? "Save" : "Add topic"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const [group, setGroup] = useState<TopicGroup | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [pending, start] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setText("");
          setGroup(null);
          setIsActive(true);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk import topics</DialogTitle>
          <DialogDescription>
            One per line. Use <code>—</code>, <code>|</code>, or <code>:</code> to add a
            description. All imported topics share the type and active state below.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={10}
          placeholder={
            "Faith in Jesus Christ — Alma 32; Helaman 5:12\nService\nThe Atonement: D&C 19; Mosiah 3:7"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="space-y-1.5">
          <Label>
            Type <span className="text-red-600">*</span>
          </Label>
          <div className="flex gap-2 flex-wrap">
            {GROUP_OPTIONS.map((g) => {
              const on = group === g.value;
              return (
                <Button
                  key={g.value}
                  type="button"
                  size="sm"
                  variant={on ? "default" : "outline"}
                  onClick={() => setGroup(g.value)}
                >
                  {g.label}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="bulk-active"
            checked={isActive}
            onCheckedChange={(v) => setIsActive(v === true)}
          />
          <Label htmlFor="bulk-active" className="cursor-pointer">
            Active (eligible for rotation)
          </Label>
        </div>
        <DialogFooter>
          <Button
            onClick={() =>
              start(async () => {
                if (!group) return;
                const r = await bulkImportTopics(
                  text,
                  GROUP_TO_CATEGORIES[group],
                  isActive,
                );
                if (r.error) toast.error(r.error);
                else {
                  toast.success(`Imported ${r.inserted} topic${r.inserted === 1 ? "" : "s"}.`);
                  setText("");
                  setGroup(null);
                  setIsActive(true);
                  onClose();
                }
              })
            }
            disabled={pending || !text.trim() || !group}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
