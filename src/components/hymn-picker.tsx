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
import { Music, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Hymn } from "@/lib/supabase/types";

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

  return (
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
  );
}
