"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { User, X, ChevronDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { weeksSinceLabel, rotationTier } from "@/lib/dates";
import { sortSpeakers } from "@/lib/rotation";
import type { Speaker, SpeakerCategory } from "@/lib/supabase/types";
import { SpeakerViewDialog } from "@/components/speaker-view-dialog";

export type SpeakerPickerChange = {
  speaker_id: string | null;
  custom_speaker_name: string | null;
};

export function SpeakerPicker({
  speakers,
  category,
  value,
  customValue,
  onChange,
  disabled,
  placeholder = "Pick a speaker…",
}: {
  speakers: Speaker[];
  category: SpeakerCategory;
  value: string | null;
  customValue: string | null;
  onChange: (next: SpeakerPickerChange) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Speaker | null>(null);
  const sorted = useMemo(() => sortSpeakers(speakers, category), [speakers, category]);
  const selected = value ? speakers.find((s) => s.id === value) : null;
  const isCustom = !selected && !!customValue;

  return (
    <div className="relative flex items-stretch gap-2">
      {/* Person icon — opens speaker detail when a speaker is selected */}
      <button
        type="button"
        aria-label={selected ? `View ${selected.full_name}` : "No speaker selected"}
        disabled={!selected || disabled}
        onClick={(e) => {
          e.preventDefault();
          if (selected) setViewing(selected);
        }}
        className={cn(
          "inline-flex items-center justify-center w-10 shrink-0 rounded-md border bg-card transition-colors",
          selected && !disabled
            ? "hover:bg-accent hover:text-primary cursor-pointer"
            : "text-muted-foreground cursor-default",
        )}
        title={selected ? "View speaker details" : undefined}
      >
        <User className="w-4 h-4" />
      </button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "flex-1 justify-between font-normal",
            !selected && !isCustom && "text-muted-foreground",
            (selected || isCustom) && !disabled && "pr-9",
          )}
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <span className="truncate">
              {selected
                ? selected.full_name
                : isCustom
                  ? customValue
                  : placeholder}
            </span>
            {isCustom && (
              <span className="text-[10px] uppercase tracking-wider text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 rounded">
                Stake
              </span>
            )}
            {selected && rotationTier(selected.last_spoke_date) === "stale" && (
              <span className="inline-flex items-center gap-1 text-[10px] text-red-700 bg-red-50 dark:bg-red-950 dark:text-red-300 px-1.5 py-0.5 rounded">
                <AlertTriangle className="w-3 h-3" />
                {weeksSinceLabel(selected.last_spoke_date)}
              </span>
            )}
          </span>
          <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[min(420px,90vw)]" align="start">
          <Command>
            <CommandInput placeholder="Search speakers…" />
            <CommandList>
              <CommandEmpty>No matching speakers.</CommandEmpty>
              <CommandGroup heading="Longest gap first">
                {sorted.map((s) => {
                  const tier = rotationTier(s.last_spoke_date);
                  return (
                    <CommandItem
                      key={s.id}
                      value={s.full_name}
                      onSelect={() => {
                        onChange({ speaker_id: s.id, custom_speaker_name: null });
                        setOpen(false);
                      }}
                    >
                      <span className="flex-1">{s.full_name}</span>
                      <span
                        className={cn(
                          "text-xs",
                          tier === "stale" && "text-red-600",
                          tier === "caution" && "text-yellow-700",
                          tier === "fresh" && "text-muted-foreground",
                        )}
                      >
                        {weeksSinceLabel(s.last_spoke_date)}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {(selected || isCustom) && !disabled && (
        <button
          type="button"
          aria-label="Clear speaker"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onChange({ speaker_id: null, custom_speaker_name: null });
          }}
          className="absolute right-7 top-1/2 -translate-y-1/2 hover:bg-accent rounded-sm p-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      <SpeakerViewDialog
        speaker={viewing}
        onClose={() => setViewing(null)}
        onEdit={() => {
          // Editing a speaker happens on the /speakers page (it owns the edit
          // dialog + the bulk-history view). Close and navigate over.
          setViewing(null);
          router.push("/speakers");
        }}
      />
    </div>
  );
}
