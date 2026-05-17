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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full justify-between font-normal",
          !selected && "text-muted-foreground",
        )}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <Music className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {selected ? `#${selected.number} — ${selected.title}` : placeholder}
          </span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected && !disabled && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="hover:bg-accent rounded-sm p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className="w-4 h-4 opacity-50" />
        </span>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[min(420px,90vw)]" align="start">
        <Command
          filter={(value, search) => {
            const q = search.toLowerCase();
            const v = value.toLowerCase();
            return v.includes(q) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search by number or title…" />
          <CommandList>
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
                  <span className="text-muted-foreground w-10 tabular-nums">#{h.number}</span>
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
      </PopoverContent>
    </Popover>
    {(usageTags.length > 0 || verseNote) && (
      <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-200 dark:ring-amber-900 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          {usageTags.length > 0 && (
            <>
              Intended for:{" "}
              <strong>
                {usageTags
                  .map((t) => HYMN_USAGE_LABELS[t] ?? t)
                  .join(", ")}
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
