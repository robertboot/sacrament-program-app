"use client";

import { useMemo, useRef, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music, ChevronDown, AlertTriangle, Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  HYMN_USAGE_LABELS,
  type Hymn,
  type HymnUsageTag,
} from "@/lib/supabase/types";

/**
 * onChange payload — mirrors TopicPicker's pattern. Exactly one of
 * hymn_id / custom_hymn_text is set (or both null for "clear").
 */
export type HymnPick = {
  hymn_id: number | null;
  custom_hymn_text: string | null;
};

export function HymnPicker({
  hymns,
  value,
  customValue = null,
  onChange,
  placeholder = "Pick a hymn…",
  disabled,
  slot,
}: {
  hymns: Hymn[];
  value: number | null;
  /** Manual-entry text. When non-empty, takes precedence over `value`. */
  customValue?: string | null;
  onChange: (next: HymnPick) => void;
  placeholder?: string;
  disabled?: boolean;
  slot?: "opening" | "sacrament" | "intermediate" | "closing";
}) {
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualDraft, setManualDraft] = useState(customValue ?? "");
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  const selected = value ? hymns.find((h) => h.id === value) : null;
  const isManual = !selected && !!customValue?.trim();

  const rawTags = (selected?.usage_tags ?? []) as HymnUsageTag[];
  const usageTags =
    slot === "sacrament" ? rawTags.filter((t) => t !== "sacrament") : rawTags;
  const verseNote = selected?.verse_note ?? null;

  const orderedHymns = useMemo(() => {
    const sorted = [...hymns].sort((a, b) => a.number - b.number);
    if (!selected) return sorted;
    const i = sorted.findIndex((h) => h.id === selected.id);
    if (i < 0) return sorted;
    return [...sorted.slice(i), ...sorted.slice(0, i)];
  }, [hymns, selected]);

  function openPicker() {
    setActiveValue(selected ? `${selected.number} ${selected.title}` : "");
    setManualMode(isManual);
    setManualDraft(customValue ?? "");
    setOpen(true);
    // Autofocus the text input if we're opening straight into manual mode.
    setTimeout(() => {
      if (isManual && manualInputRef.current) manualInputRef.current.focus();
    }, 0);
  }

  function commitManual() {
    const trimmed = manualDraft.trim();
    if (!trimmed) {
      // Empty submit → treat as clear.
      onChange({ hymn_id: null, custom_hymn_text: null });
    } else {
      onChange({ hymn_id: null, custom_hymn_text: trimmed });
    }
    setOpen(false);
    setManualMode(false);
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full justify-between font-normal",
            !selected && !isManual && "text-muted-foreground",
          )}
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <Music className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {selected
                ? `#${selected.number} — ${selected.title}`
                : isManual
                  ? customValue
                  : placeholder}
            </span>
          </span>
          <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
        </button>
        <Dialog open={open} onOpenChange={setOpen} modal={false}>
          <DialogContent className="p-0 gap-0 sm:max-w-md [max-height:85svh] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]">
            <DialogHeader className="px-4 pt-4">
              <DialogTitle className="text-sm">Pick a hymn</DialogTitle>
            </DialogHeader>

            {manualMode ? (
              <div className="p-4 space-y-3">
                <div className="text-xs text-muted-foreground">
                  Type in the hymn or musical number as you want it printed on
                  the program (e.g. &ldquo;Ward choir&rdquo;, &ldquo;Youth
                  musical number&rdquo;, or a hymn title from a book that
                  isn&rsquo;t in the picker).
                </div>
                <Input
                  ref={manualInputRef}
                  value={manualDraft}
                  onChange={(e) => setManualDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitManual();
                    }
                  }}
                  placeholder="e.g. Ward choir — How Great Thou Art"
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={commitManual}>Save</Button>
                  <Button variant="ghost" onClick={() => setManualMode(false)}>
                    Back to picker
                  </Button>
                </div>
              </div>
            ) : (
              <Command
                className="rounded-none overflow-visible h-auto!"
                value={activeValue}
                onValueChange={setActiveValue}
                filter={(value, search) => {
                  const q = search.toLowerCase();
                  return value.toLowerCase().includes(q) ? 1 : 0;
                }}
              >
                <CommandInput placeholder="Search by number or title…" />
                <CommandList className="max-h-none overflow-y-visible">
                  <CommandEmpty>No hymns found.</CommandEmpty>
                  <CommandGroup>
                    {/* "Enter manually" is always the first entry so leaders
                        never have to hunt for it. */}
                    <CommandItem
                      value="enter manually custom text"
                      onSelect={() => {
                        setManualMode(true);
                        setTimeout(() => manualInputRef.current?.focus(), 0);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                      <span className="flex-1 font-medium">Enter manually</span>
                    </CommandItem>
                    {(selected || isManual) && (
                      <CommandItem
                        value="clear no hymn"
                        onSelect={() => {
                          onChange({ hymn_id: null, custom_hymn_text: null });
                          setOpen(false);
                        }}
                        className="text-muted-foreground"
                      >
                        <X className="w-4 h-4" />
                        <span className="flex-1">Clear — no hymn</span>
                      </CommandItem>
                    )}
                    {orderedHymns.map((h) => (
                      <CommandItem
                        key={h.id}
                        value={`${h.number} ${h.title}`}
                        onSelect={() => {
                          onChange({ hymn_id: h.id, custom_hymn_text: null });
                          setOpen(false);
                        }}
                        className={cn(h.id === value && "font-semibold")}
                      >
                        <span className="text-muted-foreground w-10 tabular-nums">
                          #{h.number}
                        </span>
                        <span className="flex-1">{h.title}</span>
                        {h.hymnal === "new" && (
                          <span className="text-[10px] uppercase tracking-wider text-emerald-600">
                            new
                          </span>
                        )}
                        {h.id === value && (
                          <Check className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </DialogContent>
        </Dialog>
      </div>
      {(usageTags.length > 0 || verseNote) && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-200 dark:ring-amber-900 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            {usageTags.length > 0 && (
              <>
                Intended for:{" "}
                <strong>
                  {usageTags.map((t) => HYMN_USAGE_LABELS[t] ?? t).join(", ")}
                </strong>
                .
              </>
            )}
            {verseNote && (
              <>
                {usageTags.length > 0 ? " " : ""}
                Verse note: <strong>{verseNote}</strong>.
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
