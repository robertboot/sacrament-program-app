-- Sacrament Program Planner — Initial Schema
-- Tables, enums, indexes. Functions/triggers/RLS live in migration 0002.

create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

create type user_role as enum ('bishopric', 'chorister');
create type bishopric_position as enum ('bishop', 'first_counselor', 'second_counselor');
create type speaker_category as enum ('first', 'second', 'concluding');
create type assignment_slot as enum ('first', 'second', 'concluding');
create type assignment_status as enum ('not_yet_asked', 'awaiting_confirmation', 'confirmed', 'declined');
create type program_status as enum ('draft', 'published');

-- ============================================================================
-- profiles  (linked to auth.users)
-- ============================================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'chorister',
  bishopric_position bishopric_position,
  last_conducted_date date,
  created_at timestamptz not null default now(),
  constraint bishopric_position_only_for_bishopric check (
    (role = 'bishopric' and bishopric_position is not null)
    or (role = 'chorister' and bishopric_position is null)
  )
);

create unique index profiles_bishopric_position_unique
  on profiles (bishopric_position)
  where bishopric_position is not null;

-- ============================================================================
-- speakers
-- ============================================================================

create table speakers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  notes text,
  is_active boolean not null default true,
  last_spoke_date date,
  created_at timestamptz not null default now()
);

create index speakers_active_idx on speakers (is_active);
create index speakers_last_spoke_idx on speakers (last_spoke_date nulls first);

-- many-to-many: a speaker can be in multiple categories
create table speaker_categories (
  speaker_id uuid not null references speakers(id) on delete cascade,
  category speaker_category not null,
  primary key (speaker_id, category)
);

create index speaker_categories_category_idx on speaker_categories (category);

-- ============================================================================
-- topics
-- ============================================================================

create table topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  last_used_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index topics_active_idx on topics (is_active);
create index topics_last_used_idx on topics (last_used_date nulls first);

-- ============================================================================
-- hymns (mostly static seed data)
-- ============================================================================

create table hymns (
  id int primary key,
  number int not null unique,
  title text not null,
  -- "1985" for the classic hymnal, "new" for 2024+ releases
  hymnal text not null default '1985'
);

create index hymns_title_idx on hymns (title);

-- ============================================================================
-- programs
-- ============================================================================

create table programs (
  id uuid primary key default gen_random_uuid(),
  meeting_date date not null unique,
  presiding text,
  conducting_id uuid references profiles(id),
  welcome_text text,
  brief_reminders text,

  opening_hymn_id int references hymns(id),
  sacrament_hymn_id int references hymns(id),
  intermediate_hymn_id int references hymns(id),
  intermediate_hymn_text text,
  closing_hymn_id int references hymns(id),

  invocation text,
  benediction text,
  chorister text,
  organist text,
  releases text,
  sustainings text,
  stake_business text,

  status program_status not null default 'draft',
  share_token text not null unique default encode(gen_random_bytes(18), 'hex'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index programs_meeting_date_idx on programs (meeting_date);
create index programs_status_idx on programs (status);

-- ============================================================================
-- speaking_assignments
-- ============================================================================

create table speaking_assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  speaker_id uuid references speakers(id) on delete set null,
  topic_id uuid references topics(id) on delete set null,
  custom_topic_text text,
  slot assignment_slot not null,
  length_minutes int not null,
  status assignment_status not null default 'not_yet_asked',
  asked_at timestamptz,
  asked_by uuid references profiles(id),
  confirmed_at timestamptz,
  declined_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, slot)
);

create index sa_program_idx on speaking_assignments (program_id);
create index sa_speaker_idx on speaking_assignments (speaker_id);
create index sa_topic_idx on speaking_assignments (topic_id);
create index sa_status_idx on speaking_assignments (status);

-- Audit log: every status change with who/when
create table speaking_assignment_history (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references speaking_assignments(id) on delete cascade,
  from_status assignment_status,
  to_status assignment_status not null,
  speaker_id uuid references speakers(id),
  topic_id uuid references topics(id),
  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now(),
  note text
);

create index sah_assignment_idx on speaking_assignment_history (assignment_id);

-- ============================================================================
-- events
-- ============================================================================

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date,
  display_start date not null,
  display_end date not null,
  created_at timestamptz not null default now(),
  check (display_end >= display_start)
);

create index events_window_idx on events (display_start, display_end);

-- ============================================================================
-- app_settings  (single-row config)
-- ============================================================================

create table app_settings (
  id int primary key default 1 check (id = 1),
  default_welcome_text text not null default
    'Welcome to sacrament meeting. We''re glad you''re here.',
  assignment_paper_template text not null default
    'Thank you for your willingness to serve. Please prepare a talk based on the topic above. If you have any questions, please contact a member of the bishopric.',
  branch_name text not null default 'Branch',
  updated_at timestamptz not null default now()
);

insert into app_settings (id) values (1) on conflict do nothing;
