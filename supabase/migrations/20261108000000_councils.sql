-- Council agendas — Branch Council + BYC.
--
-- One schema serves both kinds via council_meetings.kind. Agenda body lives
-- in council_agenda_items (ordered, title + grey sub-note). BC-specific
-- fields (opening_hymn_*) and BYC-specific fields (theme, activity_date,
-- activity_ideas, looking_ahead_text) coexist as nullable columns — simpler
-- than two parallel tables, and the client picks which to render per kind.
--
-- Public share:
--   Each meeting has a share_token for /council/<token>, printable by anyone
--   with the link (same read-model as /p/<token> for the sacrament bulletin).
--   RLS lets anon SELECT a row and its items when a matching share_token
--   is passed from the public page via the service client (we read through
--   the service client for anon reads so no anon policy is needed).

create table if not exists council_meetings (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('branch_council', 'byc')),
  meeting_date date not null,

  -- BC-only (null for BYC)
  opening_hymn_id int references hymns(id),
  opening_hymn_text text,

  -- BYC-only (null for BC)
  theme text,
  activity_date date,
  activity_ideas text,
  looking_ahead_text text,

  -- Shared free-text sections. follow_up_text defaults to the stock
  -- "Review assignments and action items" bullet the template carries.
  follow_up_text text not null default 'Review assignments and action items',
  post_meeting_notes text,

  status text not null default 'draft' check (status in ('draft', 'finalized')),
  share_token text unique not null default encode(gen_random_bytes(16), 'hex'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists council_meetings_kind_date_idx
  on council_meetings (kind, meeting_date desc);

create table if not exists council_agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references council_meetings(id) on delete cascade,
  position int not null,
  title text not null default '',
  sub_note text,
  created_at timestamptz not null default now()
);

create index if not exists council_agenda_items_meeting_idx
  on council_agenda_items (meeting_id, position);

alter table council_meetings enable row level security;
alter table council_agenda_items enable row level security;

drop policy if exists "council_meetings bishopric all" on council_meetings;
drop policy if exists "council_agenda_items bishopric all" on council_agenda_items;

create policy "council_meetings bishopric all" on council_meetings
  for all to authenticated
  using (is_bishopric()) with check (is_bishopric());

create policy "council_agenda_items bishopric all" on council_agenda_items
  for all to authenticated
  using (is_bishopric()) with check (is_bishopric());
