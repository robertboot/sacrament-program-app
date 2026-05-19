"use client";

import { useState } from "react";
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
import { buttonVariants } from "@/components/ui/button";
import { Music, X, ChevronDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  HYMN_USAGE_LABELS,
  type Hymn,
  type HymnUsageTag,
} from "@/lib/supabase/types";

export function HymnPicker({
  hymns,
  value,
  onChange,
  placeholder = "Pick a hymn…",
  disabled,
}: {
  hymns: Hymn[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? hymns.find((h) => h.id === value) : null;
  const usageTags = (selected?.usage_tags ?? []) as HymnUsageTag[];
  const verseNote = selected?.verse_note ?? null;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            selected && !disabled && "pr-9",
          )}
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <Music className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {selected ? `#${selected.number} — ${selected.title}` : placeholder}
            </span>
          </span>
          {(!selected || disabled) && (
            <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
          )}
        </button>
        {selected && !disabled && (
          <button
            type="button"
            aria-label="Clear hymn"
            onClick={() => onChange(null)}
            className="absolute right-3 top-1/2 -translate-y-1/2 hover:bg-accent rounded-sm p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <Dialog open={open} onOpenChange={setOpen} modal={false}>
          <DialogContent className="p-0 gap-0 sm:max-w-md [max-height:85svh] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]">
            <DialogHeader className="px-4 pt-4">
              <DialogTitle className="text-sm">Pick a hymn</DialogTitle>
            </DialogHeader>
            <Command
              className="rounded-none overflow-visible h-auto!"
              filter={(value, search) => {
                const q = search.toLowerCase();
                return value.toLowerCase().includes(q) ? 1 : 0;
              }}
            >
              <CommandInput placeholder="Search by number or title…" />
              <CommandList className="max-h-none overflow-y-visible">
                <CommandEmpty>No hymns found.</CommandEmpty>
                <CommandGroup>
                  {hymns.map((h) => (
                    <CommandItem
                      key={h.id}
                      value={`${h.number} ${h.title}`}
                      onSelect={() => {
                        onChange(h.id);
                        setOpen(false);
                      }}
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
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
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
