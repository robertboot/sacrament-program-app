import { createServiceClient } from "@/lib/supabase/server";
import type { FsyLesson } from "@/lib/supabase/types";

/**
 * Server-only FSY lesson helpers. Lives in its own file so the pure
 * constants and date helpers in ./fsy-lessons can be imported from
 * client components (the agenda renderer uses YEAR_THEMES) without
 * dragging the `next/headers`-flavored Supabase server client along.
 */

/**
 * Get a FSY lesson, preferring a cached row no older than 90 days.
 * Falls back to a live fetch; on fetch success upserts the cache. If
 * both paths fail the caller renders "(verify)" placeholders instead
 * of leaving the agenda blank.
 */
export async function getFsyLesson(
  year: number,
  month: number,
): Promise<FsyLesson | null> {
  const sb = createServiceClient();
  const { data: cached } = await sb
    .from("fsy_lessons")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (cached) {
    const ageMs = Date.now() - new Date((cached as FsyLesson).fetched_at).getTime();
    if (ageMs < 90 * 24 * 60 * 60 * 1000) return cached as FsyLesson;
  }
  const fetched = await fetchFsyLesson(year, month);
  if (!fetched) return (cached as FsyLesson | null) ?? null;
  await sb.from("fsy_lessons").upsert(
    {
      year,
      month,
      chapter_title: fetched.chapter_title,
      scripture: fetched.scripture,
      pages: fetched.pages,
      idea_a: fetched.idea_a,
      idea_b: fetched.idea_b,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "year,month" },
  );
  return {
    year,
    month,
    fetched_at: new Date().toISOString(),
    ...fetched,
  };
}

async function fetchFsyLesson(
  year: number,
  month: number,
): Promise<Omit<FsyLesson, "year" | "month" | "fetched_at"> | null> {
  const mm = String(month).padStart(2, "0");
  const base = `https://www.churchofjesuschrist.org/study/ftsoy/${year}/${mm}/fsy-lessons`;
  const [intro, fast, ideaA, ideaB] = await Promise.all([
    fetchText(`${base}/00-intro?lang=eng`),
    fetchText(`${base}/01-fast-sunday?lang=eng`),
    fetchText(`${base}/05a-activity-idea?lang=eng`),
    fetchText(`${base}/05b-activity-idea?lang=eng`),
  ]);
  if (!intro) return null;
  const chapter_title = extractTitle(intro);
  const scripture = extractScripture(intro);
  const pages = fast ? extractPages(fast) : null;
  const idea_a = ideaA ? extractTitle(ideaA) : null;
  const idea_b = ideaB ? extractTitle(ideaB) : null;
  return { chapter_title, scripture, pages, idea_a, idea_b };
}

async function fetchText(url: string, timeoutMs = 6000): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RotaAgendaBot/1.0; +https://sacramentplanner.ai)",
      },
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractTitle(html: string): string | null {
  const og = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  if (og) return cleanTitle(decode(og[1]));
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t) return cleanTitle(decode(stripTags(t[1])));
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return cleanTitle(decode(stripTags(h1[1])));
  return null;
}

function cleanTitle(s: string): string {
  return s
    .replace(/\s*\|\s*.*(Jesus Christ|Latter-day Saints|Church).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractScripture(html: string): string | null {
  const text = stripTags(html);
  const m = text.match(
    /\b([1-3]?\s?[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(\d{1,3}):(\d{1,3}(?:[\-–—]\d{1,3})?)/,
  );
  if (!m) return null;
  return `${m[1].replace(/\s+/g, " ").trim()} ${m[2]}:${m[3].replace(/[–—]/g, "–")}`;
}

function extractPages(html: string): string | null {
  const text = stripTags(html);
  const m = text.match(/(?:pp\.?\s*)?(\d{1,3})\s*[–—\-]\s*(\d{1,3})\s*\)/);
  if (m) return `${m[1]}–${m[2]}`;
  return null;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&nbsp;/g, " ");
}
