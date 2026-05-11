"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SpeakerCategory } from "@/lib/supabase/types";

type TopicInput = {
  title: string;
  description?: string | null;
  is_active: boolean;
  categories: SpeakerCategory[];
};

export async function createTopic(input: TopicInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .insert({
      title: input.title,
      description: input.description,
      is_active: input.is_active,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  if (input.categories.length) {
    const { error: catErr } = await supabase
      .from("topic_categories")
      .insert(input.categories.map((c) => ({ topic_id: data!.id, category: c })));
    if (catErr) return { error: catErr.message };
  }
  revalidatePath("/topics");
  return { error: null };
}

export async function updateTopic(id: string, input: TopicInput) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("topics")
    .update({
      title: input.title,
      description: input.description,
      is_active: input.is_active,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("topic_categories").delete().eq("topic_id", id);
  if (input.categories.length) {
    const { error: catErr } = await supabase
      .from("topic_categories")
      .insert(input.categories.map((c) => ({ topic_id: id, category: c })));
    if (catErr) return { error: catErr.message };
  }
  revalidatePath("/topics");
  return { error: null };
}

export async function deactivateTopic(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("topics").update({ is_active: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/topics");
  return { error: null };
}

/**
 * Bulk import: rows of "Title — description" or "Title | description" or just
 * "Title". All imported topics share the same category group and active state
 * picked in the dialog.
 */
export async function bulkImportTopics(
  rawText: string,
  categories: SpeakerCategory[],
  isActive: boolean,
) {
  const supabase = await createClient();
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const rows = lines.map((line) => {
    const splitRe = /\s+[—\-|]\s+|: /;
    const m = line.match(splitRe);
    if (m) {
      const idx = m.index!;
      return {
        title: line.slice(0, idx).trim(),
        description: line.slice(idx + m[0].length).trim(),
        is_active: isActive,
      };
    }
    return { title: line, description: null, is_active: isActive };
  });
  if (rows.length === 0) return { inserted: 0, error: null };
  const { data, error } = await supabase.from("topics").insert(rows).select("id");
  if (error) return { inserted: 0, error: error.message };
  if (data && data.length > 0 && categories.length > 0) {
    const catRows = data.flatMap((row) =>
      categories.map((category) => ({ topic_id: row.id, category })),
    );
    const { error: catErr } = await supabase.from("topic_categories").insert(catRows);
    if (catErr) return { inserted: rows.length, error: catErr.message };
  }
  revalidatePath("/topics");
  return { inserted: rows.length, error: null };
}
