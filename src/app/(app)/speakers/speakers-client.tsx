"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Upload,
  Pencil,
  Trash2,
  ChevronDown,
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
import { weeksSinceLabel, rotationTier } from "@/lib/dates";
import type { Speaker, SpeakerCategory } from "@/lib/supabase/types";
import {
  createSpeaker,
  updateSpeaker,
  deleteSpeaker,
  getSpeakerHistory,
  bulkImportSpeakers,
} from "./actions";
import { cn } from "@/lib/utils";

const CATS: { value: SpeakerCategory; label: string }[] = [
  { value: "first", label: "5 min" },
  { value: "second", label: "10 min" },
  { value: "concluding", label: "15 min" },
];

type CategoryFilter = "all" | SpeakerCategory;

const FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "first", label: "5 min" },
  { value: "second", label: "10 min" },
  { value: "concluding", label: "15 min" },
];

type SortBy = "name" | "last_spoke";

const SORTS: { value: SortBy; label: string; shortLabel: string }[] = [
  { value: "name", label: "Name (A→Z)", shortLabel: "Name A–Z" },
  {
    value: "last_spoke",
    label: "Last spoke (longest gap first)",
    shortLabel: "Last spoke",
  },
];

export function SpeakersClient({ initialSpeakers }: { initialSpeakers: Speaker[] }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [viewing, setViewing] = useState<Speaker | null>(null);
  const [editing, setEditing] = useState<Speaker | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = initialSpeakers.filter((s) => {
      if (q && !s.full_name.toLowerCase().includes(q)) return false;
      if (categoryFilter !== "all" && !(s.categories ?? []).includes(categoryFilter))
        return false;
      return true;
    });

    if (sortBy === "name") {
      return [...matched].sort((a, b) => a.full_name.localeCompare(b.full_name));
    }
    // last_spoke: longest gap first; "never spoke" floats to the top
    return [...matched].sort((a, b) => {
      if (a.last_spoke_date === null && b.last_spoke_date === null)
        return a.full_name.localeCompare(b.full_name);
      if (a.last_spoke_date === null) return -1;
      if (b.last_spoke_date === null) return 1;
      return a.last_spoke_date.localeCompare(b.last_spoke_date);
    });
  }, [search, categoryFilter, sortBy, initialSpeakers]);

  const active = filtered.filter((s) => s.is_active);
  const inactive = filtered.filter((s) => !s.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">Speakers</h1>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>{active.length} active</span>
            <span aria-hidden>·</span>
            <span>Rotation uses longest gap</span>
            <Popover>
              <PopoverTrigger
                aria-label="What does the rotation use?"
                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              >
                <Info className="w-3.5 h-3.5" />
              </PopoverTrigger>
              <PopoverContent className="text-xs w-64">
                Speakers with the longest gap since they last spoke float to the
                top of the rotation. The picker uses the same order so the
                bishop sees who&rsquo;s up next.
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <Button onClick={() => setShowAdd(true)} className="shrink-0">
          <Plus className="w-4 h-4" />
          Add speaker
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search speakers…"
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
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg bg-card px-3 h-7 text-[0.8rem] font-medium ring-1 ring-border hover:bg-muted",
              )}
            >
              {SORTS.find((s) => s.value === sortBy)?.shortLabel ??
                "Name A–Z"}
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SORTS.map((s) => (
                <DropdownMenuItem
                  key={s.value}
                  onClick={() => setSortBy(s.value)}
                >
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="More speaker actions"
              className="inline-flex items-center justify-center rounded-lg bg-card h-7 w-7 ring-1 ring-border hover:bg-muted"
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
      </div>

      <div className="space-y-2">
        {active.map((s) => (
          <SpeakerRow key={s.id} speaker={s} onClick={() => setViewing(s)} />
        ))}
      </div>

      {inactive.length > 0 && (
        <details className="mt-6">
          <summary className="text-sm text-muted-foreground cursor-pointer">
            Inactive ({inactive.length})
          </summary>
          <div className="space-y-2 mt-2">
            {inactive.map((s) => (
              <SpeakerRow key={s.id} speaker={s} onClick={() => setViewing(s)} />
            ))}
          </div>
        </details>
      )}

      <SpeakerViewDialog
        speaker={viewing}
        onClose={() => setViewing(null)}
        onEdit={() => {
          const s = viewing;
          setViewing(null);
          setEditing(s);
        }}
      />

      <SpeakerDialog
        open={showAdd || !!editing}
        speaker={editing}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
      />
      <BulkImportDialog open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}

function SpeakerRow({ speaker, onClick }: { speaker: Speaker; onClick: () => void }) {
  const tier = rotationTier(speaker.last_spoke_date);
  return (
    <Card
      className="py-0 cursor-pointer hover:bg-accent/30 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate flex items-center gap-2">
            {speaker.full_name}
            {!speaker.is_active && (
              <Badge variant="outline" className="text-[10px]">
                inactive
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2 items-center">
            <span>
              {speaker.categories?.length ? (
                <span className="font-medium text-foreground/80">
                  {speaker.categories
                    .map((c) => CATS.find((x) => x.value === c)?.label)
                    .filter(Boolean)
                    .join(" · ")}{" "}
                  speaker
                </span>
              ) : (
                <span className="italic">no categories</span>
              )}
            </span>
            <span aria-hidden="true">·</span>
            <span
              className={cn(
                tier === "stale" && "text-red-600 dark:text-red-400",
                tier === "caution" && "text-yellow-700 dark:text-yellow-400",
              )}
            >
              Last spoke {weeksSinceLabel(speaker.last_spoke_date).toLowerCase()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SpeakerViewDialog({
  speaker,
  onClose,
  onEdit,
}: {
  speaker: Speaker | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [pending, start] = useTransition();
  const [history, setHistory] = useState<
    { date: string; kind: "upcoming" | "past" }[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!speaker?.id) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    getSpeakerHistory(speaker.id).then((r) => {
      if (cancelled) return;
      setHistory(r.entries);
      setHistoryLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [speaker?.id]);

  if (!speaker) return null;

  return (
    <Dialog open={!!speaker} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {speaker.full_name}
            {!speaker.is_active && (
              <Badge variant="outline" className="text-[10px]">
                inactive
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {speaker.categories?.length
              ? speaker.categories
                  .map((c) => CATS.find((x) => x.value === c)?.label)
                  .filter(Boolean)
                  .join(" · ") + " speaker"
              : "No categories tagged"}{" "}
            · Last spoke {weeksSinceLabel(speaker.last_spoke_date).toLowerCase()}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {speaker.notes && (
            <div className="space-y-0.5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Notes
              </div>
              <div className="whitespace-pre-wrap">{speaker.notes}</div>
            </div>
          )}
          <div className="space-y-0.5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Speaking history
            </div>
            {historyLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No assignments in the system.
                {speaker.last_spoke_date && (
                  <>
                    {" "}
                    Manual backfill: {weeksSinceLabel(speaker.last_spoke_date)}.
                  </>
                )}
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 text-xs space-y-0.5">
                {history.map((e) => (
                  <div
                    key={`${e.kind}-${e.date}`}
                    className={cn(
                      "flex items-center gap-2",
                      e.kind === "upcoming" &&
                        "text-emerald-700 dark:text-emerald-400 font-medium",
                    )}
                  >
                    <span>{format(parseISO(e.date), "EEE, MMM d, yyyy")}</span>
                    {e.kind === "upcoming" && (
                      <span className="text-[10px] uppercase tracking-wider">
                        Upcoming
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950 mr-auto"
            disabled={pending}
            onClick={() => {
              if (
                !confirm(
                  `Delete ${speaker.full_name} permanently? Past programs will show "—" instead of their name. To keep history but pause assignments, edit and uncheck Active instead.`,
                )
              )
                return;
              start(async () => {
                const r = await deleteSpeaker(speaker.id);
                if (r.error) toast.error(r.error);
                else {
                  toast.success("Speaker deleted.");
                  onClose();
                }
              });
            }}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Close
          </Button>
          <Button onClick={onEdit} disabled={pending}>
            <Pencil className="w-4 h-4" />
            Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SpeakerDialog({
  open,
  speaker,
  onClose,
}: {
  open: boolean;
  speaker: Speaker | null;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [fullName, setFullName] = useState(speaker?.full_name ?? "");
  const [phone, setPhone] = useState(speaker?.phone ?? "");
  const [notes, setNotes] = useState(speaker?.notes ?? "");
  const [isActive, setIsActive] = useState(speaker?.is_active ?? true);
  const [cats, setCats] = useState<SpeakerCategory[]>(speaker?.categories ?? []);
  const [lastSpoke, setLastSpoke] = useState(speaker?.last_spoke_date ?? "");
  const [history, setHistory] = useState<
    { date: string; kind: "upcoming" | "past" }[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Re-init when dialog target changes.
  const [trackedId, setTrackedId] = useState(speaker?.id);
  if (speaker?.id !== trackedId) {
    setTrackedId(speaker?.id);
    setFullName(speaker?.full_name ?? "");
    setPhone(speaker?.phone ?? "");
    setNotes(speaker?.notes ?? "");
    setIsActive(speaker?.is_active ?? true);
    setCats(speaker?.categories ?? []);
    setLastSpoke(speaker?.last_spoke_date ?? "");
    setHistory([]);
  }

  // Fetch full speaking history when the dialog opens for an existing speaker.
  useEffect(() => {
    if (!open || !speaker?.id) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    getSpeakerHistory(speaker.id).then((r) => {
      if (cancelled) return;
      setHistory(r.entries);
      setHistoryLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, speaker?.id]);

  function toggleCat(c: SpeakerCategory) {
    setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function onSubmit() {
    start(async () => {
      const payload = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        email: null,
        notes: notes.trim() || null,
        is_active: isActive,
        categories: cats,
        last_spoke_date: lastSpoke || null,
      };
      const r = speaker
        ? await updateSpeaker(speaker.id, payload)
        : await createSpeaker(payload);
      if (r.error) toast.error(r.error);
      else {
        toast.success(speaker ? "Speaker updated." : "Speaker added.");
        onClose();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{speaker ? "Edit speaker" : "Add speaker"}</DialogTitle>
          <DialogDescription>
            Pick the talk lengths they can be assigned to. Last spoke:{" "}
            {weeksSinceLabel(speaker?.last_spoke_date ?? null)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Mobile phone (for text invites)</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(205) 555-1234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Optional. Leave blank if you don&apos;t want this speaker to receive SMS invites.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Categories</Label>
            <div className="flex gap-2 flex-wrap">
              {CATS.map((c) => {
                const on = cats.includes(c.value);
                return (
                  <Button
                    key={c.value}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    onClick={() => toggleCat(c.value)}
                  >
                    {c.label}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last-spoke">Last spoke (optional)</Label>
            <Input
              id="last-spoke"
              type="date"
              value={lastSpoke}
              onChange={(e) => setLastSpoke(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Backfill for speakers who spoke before this app was set up. Auto-updates from
              confirmed assignments going forward.
            </p>
          </div>
          {speaker && (
            <div className="space-y-1.5">
              <Label>Speaking history</Label>
              {historyLoading ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : history.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No confirmed past assignments in the system.
                  {lastSpoke && (
                    <>
                      {" "}
                      The "Last spoke" date above is a manual backfill from before the
                      schedule was loaded.
                    </>
                  )}
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 text-xs space-y-0.5">
                  {history.map((e) => (
                    <div
                      key={`${e.kind}-${e.date}`}
                      className={cn(
                        "flex items-center gap-2",
                        e.kind === "upcoming" &&
                          "text-emerald-700 dark:text-emerald-400 font-medium",
                      )}
                    >
                      <span>{format(parseISO(e.date), "EEE, MMM d, yyyy")}</span>
                      {e.kind === "upcoming" && (
                        <span className="text-[10px] uppercase tracking-wider">
                          Upcoming
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="active"
              checked={isActive}
              onCheckedChange={(v) => setIsActive(v === true)}
            />
            <Label htmlFor="active" className="cursor-pointer">
              Active (eligible for assignment)
            </Label>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {speaker && (
            <Button
              variant="outline"
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={() => {
                if (
                  !confirm(
                    `Delete ${speaker.full_name} permanently? Past programs will show "—" instead of their name. To keep history but pause assignments, uncheck Active instead.`,
                  )
                )
                  return;
                start(async () => {
                  const r = await deleteSpeaker(speaker.id);
                  if (r.error) toast.error(r.error);
                  else {
                    toast.success("Speaker deleted.");
                    onClose();
                  }
                });
              }}
              disabled={pending}
            >
              Delete speaker
            </Button>
          )}
          <Button onClick={onSubmit} disabled={pending || !fullName.trim()}>
            {speaker ? "Save" : "Add speaker"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const [defaultCats, setDefaultCats] = useState<SpeakerCategory[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [pending, start] = useTransition();

  function toggleCat(c: SpeakerCategory) {
    setDefaultCats((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setText("");
          setDefaultCats([]);
          setIsActive(true);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk import speakers</DialogTitle>
          <DialogDescription>
            One per line:{" "}
            <code className="text-xs">Name, first|second|concluding</code> (categories optional).
            <br />
            Rows without inline categories fall back to the categories you pick below.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={10}
          placeholder={"John Smith, first\nMary Jones, second|concluding\nBro. Davis"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="space-y-1.5">
          <Label>Default categories (applied to rows without inline categories)</Label>
          <div className="flex gap-2 flex-wrap">
            {CATS.map((c) => {
              const on = defaultCats.includes(c.value);
              return (
                <Button
                  key={c.value}
                  type="button"
                  size="sm"
                  variant={on ? "default" : "outline"}
                  onClick={() => toggleCat(c.value)}
                >
                  {c.label}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="bulk-speaker-active"
            checked={isActive}
            onCheckedChange={(v) => setIsActive(v === true)}
          />
          <Label htmlFor="bulk-speaker-active" className="cursor-pointer">
            Active (eligible for assignment)
          </Label>
        </div>
        <DialogFooter>
          <Button
            onClick={() =>
              start(async () => {
                const r = await bulkImportSpeakers(text, defaultCats, isActive);
                toast.success(`Imported ${r.inserted} speaker${r.inserted === 1 ? "" : "s"}.`);
                setText("");
                setDefaultCats([]);
                setIsActive(true);
                onClose();
              })
            }
            disabled={pending || !text.trim()}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
