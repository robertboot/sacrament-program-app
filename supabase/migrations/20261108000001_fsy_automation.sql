-- BYC automation: per-month FSY lesson cache + extra council_meetings fields.
--
-- fsy_lessons holds one row per (year, month) with what we scraped from
-- churchofjesuschrist.org/study/ftsoy/YYYY/MM/fsy-lessons/*. It's a
-- fallback cache: on BYC creation we fetch live; if the fetch fails we
-- fall back to whatever's here (and if that's missing too, we render
-- the agenda with a "(verify)" marker instead of leaving fields blank).
--
-- theme_scripture / theme_pages let us keep the extracted chapter info
-- for the agenda's "FSY guide, pp. XX–YY" tail and for later use.

alter table council_meetings
  add column if not exists theme_scripture text,
  add column if not exists theme_pages text;

create table if not exists fsy_lessons (
  year int not null,
  month int not null check (month between 1 and 12),
  chapter_title text,
  scripture text,
  pages text,
  idea_a text,
  idea_b text,
  fetched_at timestamptz not null default now(),
  primary key (year, month)
);

alter table fsy_lessons enable row level security;

drop policy if exists "fsy_lessons bishopric all" on fsy_lessons;
create policy "fsy_lessons bishopric all" on fsy_lessons
  for all to authenticated
  using (is_bishopric()) with check (is_bishopric());
