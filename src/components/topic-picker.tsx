"use client";

import { useMemo, useState } from "react";
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
import { BookOpen, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { weeksSinceLabel } from "@/lib/dates";
import { sortTopics } from "@/lib/rotation";
import type { SpeakerCategory, Topic } from "@/lib/supabase/types";

export function TopicPicker({
  topics,
  value,
  customValue,
  onChange,
  disabled,
  allowedCategories,
}: {
  topics: Topic[];
  value: string | null; // topic_id
  customValue: string | null; // custom_topic_text
  onChange: (next: { topic_id: string | null; custom_topic_text: string | null }) => void;
  disabled?: boolean;
  /** If supplied, only topics tagged with one of these categories show up. */
  allowedCategories?: SpeakerCategory[];
}) {
  const [open, setOpen] = useState(false);
  const sorted = useMemo(() => {
    const all = sortTopics(topics);
    if (!allowedCategories?.length) return all;
    return all.filter((t) =>
      (t.categories ?? []).some((c) => allowedCategories.includes(c)),
    );
  }, [topics, allowedCategories]);
  const selected = value ? topics.find((t) => t.id === value) : null;
  const display = selected?.title ?? customValue ?? "";

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full justify-between font-normal text-left",
          !display && "text-muted-foreground",
          (value || customValue) && !disabled && "pr-9",
        )}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 shrink-0" />
          <span className="truncate">{display || "Pick a topic…"}</span>
        </span>
        {(!(value || customValue) || disabled) && (
          <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
        )}
      </button>

      {(value || customValue) && !disabled && (
        <button
          type="button"
          aria-label="Clear topic"
          onClick={() => onChange({ topic_id: null, custom_topic_text: null })}
          className="absolute right-3 top-1/2 -translate-y-1/2 hover:bg-accent rounded-sm p-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen} modal={false}>
        <DialogContent className="p-0 gap-0 sm:max-w-md [max-height:85svh] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="text-sm">Pick a topic</DialogTitle>
          </DialogHeader>
          <Command className="rounded-none overflow-visible h-auto!">
            <CommandInput
              placeholder="Search or type a one-off topic, press Enter…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const input = (e.target as HTMLInputElement).value.trim();
                  if (input) {
                    onChange({ topic_id: null, custom_topic_text: input });
                    setOpen(false);
                    e.preventDefault();
                  }
                }
              }}
            />
            <CommandList className="max-h-none overflow-y-visible">
              <CommandEmpty>
                <div className="text-sm text-muted-foreground py-3">
                  Press Enter to use as a one-off topic.
                </div>
              </CommandEmpty>
              <CommandGroup heading="Longest unused first">
                {sorted.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={t.title + " " + (t.description ?? "")}
                    onSelect={() => {
                      onChange({ topic_id: t.id, custom_topic_text: null });
                      setOpen(false);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{t.title}</div>
                      {t.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {t.description}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {weeksSinceLabel(t.last_used_date)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}
