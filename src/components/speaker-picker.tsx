"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
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
import { User, X, ChevronDown, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { weeksSinceLabel, rotationTier } from "@/lib/dates";
import { sortSpeakers } from "@/lib/rotation";
import type { Speaker, SpeakerCategory } from "@/lib/supabase/types";
import { SpeakerViewDialog } from "@/components/speaker-view-dialog";

export type SpeakerPickerChange = {
  speaker_id: string | null;
  custom_speaker_name: string | null;
};

function gapSort(a: Speaker, b: Speaker) {
  const ad = a.last_spoke_date;
  const bd = b.last_spoke_date;
  if (ad === null && bd === null) return a.full_name.localeCompare(b.full_name);
  if (ad === null) return -1;
  if (bd === null) return 1;
  return ad.localeCompare(bd);
}

export function SpeakerPicker({
  speakers,
  category,
  value,
  customValue,
  onChange,
  disabled,
  upcomingBySpeaker = {},
  placeholder = "Pick a speaker…",
}: {
  speakers: Speaker[];
  category: SpeakerCategory;
  value: string | null;
  customValue: string | null;
  onChange: (next: SpeakerPickerChange) => void;
  disabled?: boolean;
  /** speaker_id → sorted list of upcoming meeting dates (YYYY-MM-DD) they're
   *  already booked on, so the picker can warn before double-booking. */
  upcomingBySpeaker?: Record<string, string[]>;
  placeholder?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Speaker | null>(null);
  // Speakers tagged for this slot's length come first (the real rotation
  // suggestion). Everyone else active is still selectable below so a bishop
  // can assign anyone regardless of their length tag.
  const { preferred, others } = useMemo(() => {
    const pref = sortSpeakers(speakers, category);
    const prefIds = new Set(pref.map((s) => s.id));
    const rest = speakers
      .filter((s) => s.is_active && !prefIds.has(s.id))
      .sort(gapSort);
    return { preferred: pref, others: rest };
  }, [speakers, category]);
  const selected = value ? speakers.find((s) => s.id === value) : null;
  const isCustom = !selected && !!customValue;

  function upcomingLabel(id: string): string | null {
    const dates = upcomingBySpeaker[id];
    if (!dates || dates.length === 0) return null;
    const next = dates[0];
    const extra = dates.length > 1 ? ` +${dates.length - 1}` : "";
    return `Scheduled ${format(parseISO(next), "MMM d")}${extra}`;
  }

  function renderItem(s: Speaker) {
    const tier = rotationTier(s.last_spoke_date);
    const upcoming = upcomingLabel(s.id);
    return (
      <CommandItem
        key={s.id}
        value={s.full_name}
        onSelect={() => {
          onChange({ speaker_id: s.id, custom_speaker_name: null });
          setOpen(false);
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="truncate">{s.full_name}</div>
          {upcoming && (
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
              {upcoming}
            </div>
          )}
        </div>
        <span
          className={cn(
            "text-xs shrink-0",
            tier === "stale" && "text-red-600",
            tier === "caution" && "text-yellow-700",
            tier === "fresh" && "text-muted-foreground",
          )}
        >
          {weeksSinceLabel(s.last_spoke_date)}
        </span>
      </CommandItem>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            type="button"
            disabled={disabled}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full justify-between font-normal",
              !selected && !isCustom && "text-muted-foreground",
              (selected || isCustom) && !disabled && "pr-9",
            )}
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <User className="w-4 h-4 shrink-0" />
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
                {preferred.length > 0 && (
                  <CommandGroup heading="For this slot · longest gap first">
                    {preferred.map(renderItem)}
                  </CommandGroup>
                )}
                {others.length > 0 && (
                  <CommandGroup heading="Other speakers">
                    {others.map(renderItem)}
                  </CommandGroup>
                )}
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
      </div>

      {/* Tiny "View details" link, only when a real speaker is selected */}
      {selected && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setViewing(selected);
          }}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
        >
          <Info className="w-3 h-3" />
          View {selected.full_name}&rsquo;s details
        </button>
      )}

      <SpeakerViewDialog
        speaker={viewing}
        onClose={() => setViewing(null)}
        onEdit={() => {
          setViewing(null);
          router.push("/speakers");
        }}
      />
    </div>
  );
}
