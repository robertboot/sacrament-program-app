// Client-side helpers for the "Suggest"/picker UI.
// The authoritative rotation logic lives in Postgres functions:
// next_conductor(), next_speaker(), next_topic(), ensure_next_3_months_programs().
// These helpers mirror the sort order so the picker shows people in the same
// order the auto-create job would have picked them.

import type { Speaker, Topic, Profile, SpeakerCategory } from "./supabase/types";
import { weeksSince } from "./dates";

type Sortable = { last_date: string | null; id: string };

function sortByLongestGap<T extends Sortable>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.last_date === null && b.last_date === null) return a.id.localeCompare(b.id);
    if (a.last_date === null) return -1; // never spoken → top
    if (b.last_date === null) return 1;
    return a.last_date.localeCompare(b.last_date); // older date first
  });
}

export function sortSpeakers(
  speakers: Speaker[],
  category: SpeakerCategory,
): Speaker[] {
  const filtered = speakers.filter(
    (s) => s.is_active && (s.categories ?? []).includes(category),
  );
  return sortByLongestGap(
    filtered.map((s) => ({ ...s, last_date: s.last_spoke_date })),
  );
}

export function sortTopics(topics: Topic[]): Topic[] {
  const filtered = topics.filter((t) => t.is_active);
  return sortByLongestGap(
    filtered.map((t) => ({ ...t, last_date: t.last_used_date })),
  );
}

export function sortBishopric(profiles: Profile[]): Profile[] {
  const filtered = profiles.filter((p) => p.role === "bishopric");
  return sortByLongestGap(
    filtered.map((p) => ({ ...p, last_date: p.last_conducted_date })),
  );
}

// Re-export the ward/branch-aware label helper so existing imports keep working.
// New code should import from `@/lib/labels` directly.
export { bishopricPositionLabel } from "./labels";

export { weeksSince };
