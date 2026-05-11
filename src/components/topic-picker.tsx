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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full justify-between font-normal text-left",
          !display && "text-muted-foreground",
        )}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 shrink-0" />
          <span className="truncate">{display || "Pick a topic…"}</span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {(value || customValue) && !disabled && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ topic_id: null, custom_topic_text: null });
              }}
              className="hover:bg-accent rounded-sm p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className="w-4 h-4 opacity-50" />
        </span>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[min(500px,90vw)]" align="start">
        <Command>
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
          <CommandList>
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
      </PopoverContent>
    </Popover>
  );
}
