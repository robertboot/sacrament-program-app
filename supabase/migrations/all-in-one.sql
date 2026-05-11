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
-- Functions, triggers, RLS policies.

-- ============================================================================
-- Helpers
-- ============================================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger programs_updated_at before update on programs
  for each row execute function set_updated_at();
create trigger speaking_assignments_updated_at before update on speaking_assignments
  for each row execute function set_updated_at();
create trigger app_settings_updated_at before update on app_settings
  for each row execute function set_updated_at();

-- Auto-create a profile row when auth.users gets a new row.
create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'chorister'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- Role helpers (used by RLS policies).
create or replace function current_user_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_bishopric()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'bishopric' from profiles where id = auth.uid()), false);
$$;

-- ============================================================================
-- Rotation date recompute functions
-- ============================================================================

create or replace function recompute_speaker_last_spoke(p_speaker_id uuid)
returns void language sql as $$
  update speakers s set last_spoke_date = (
    select max(p.meeting_date)
    from speaking_assignments a
    join programs p on p.id = a.program_id
    where a.speaker_id = p_speaker_id
      and a.status = 'confirmed'
      and p.meeting_date <= current_date
  )
  where s.id = p_speaker_id;
$$;

create or replace function recompute_topic_last_used(p_topic_id uuid)
returns void language sql as $$
  update topics t set last_used_date = (
    select max(p.meeting_date)
    from speaking_assignments a
    join programs p on p.id = a.program_id
    where a.topic_id = p_topic_id
      and a.status = 'confirmed'
      and p.meeting_date <= current_date
  )
  where t.id = p_topic_id;
$$;

create or replace function recompute_bishopric_last_conducted(p_profile_id uuid)
returns void language sql as $$
  update profiles pr set last_conducted_date = (
    select max(p.meeting_date)
    from programs p
    where p.conducting_id = p_profile_id
      and p.meeting_date <= current_date
  )
  where pr.id = p_profile_id;
$$;

-- Bulk recompute — call from a cron (daily) to advance rotation dates as meetings pass.
create or replace function recompute_all_rotation_dates()
returns void language plpgsql as $$
declare
  s_id uuid; t_id uuid; p_id uuid;
begin
  for s_id in select id from speakers loop
    perform recompute_speaker_last_spoke(s_id);
  end loop;
  for t_id in select id from topics loop
    perform recompute_topic_last_used(t_id);
  end loop;
  for p_id in select id from profiles where role = 'bishopric' loop
    perform recompute_bishopric_last_conducted(p_id);
  end loop;
end;
$$;

-- ============================================================================
-- Assignment status logging + auto-recompute trigger
-- ============================================================================

create or replace function log_speaking_assignment_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_changed_by uuid;
begin
  v_changed_by := auth.uid();

  if (tg_op = 'INSERT') then
    insert into speaking_assignment_history
      (assignment_id, from_status, to_status, speaker_id, topic_id, changed_by)
      values (new.id, null, new.status, new.speaker_id, new.topic_id, v_changed_by);

  elsif (tg_op = 'UPDATE') then
    if (old.status is distinct from new.status
        or old.speaker_id is distinct from new.speaker_id
        or old.topic_id is distinct from new.topic_id) then
      insert into speaking_assignment_history
        (assignment_id, from_status, to_status, speaker_id, topic_id, changed_by)
        values (new.id, old.status, new.status, new.speaker_id, new.topic_id, v_changed_by);
    end if;

    -- If a speaker becomes confirmed (and meeting date is past), refresh their last_spoke_date.
    if (new.status = 'confirmed' and old.status is distinct from 'confirmed' and new.speaker_id is not null) then
      perform recompute_speaker_last_spoke(new.speaker_id);
    end if;
    if (new.status = 'confirmed' and old.status is distinct from 'confirmed' and new.topic_id is not null) then
      perform recompute_topic_last_used(new.topic_id);
    end if;
  end if;

  return new;
end;
$$;

create trigger speaking_assignments_log
  after insert or update on speaking_assignments
  for each row execute function log_speaking_assignment_change();

-- ============================================================================
-- Topic-lock guard: once status leaves not_yet_asked, freeze topic + speaker
-- unless the slot is reset back to not_yet_asked.
-- ============================================================================

create or replace function guard_locked_assignment()
returns trigger language plpgsql as $$
begin
  if (old.status <> 'not_yet_asked' and new.status <> 'not_yet_asked') then
    if (old.topic_id is distinct from new.topic_id
        or coalesce(old.custom_topic_text, '') <> coalesce(new.custom_topic_text, '')
        or old.speaker_id is distinct from new.speaker_id) then
      raise exception 'Cannot change speaker or topic once assignment is locked. Reset slot first.';
    end if;
  end if;

  -- If status moves back to not_yet_asked, clear locked timestamps.
  if (new.status = 'not_yet_asked' and old.status <> 'not_yet_asked') then
    new.asked_at := null;
    new.asked_by := null;
    new.confirmed_at := null;
    new.declined_at := null;
  end if;

  -- Auto-stamp timestamps on transitions.
  if (new.status = 'awaiting_confirmation' and old.status is distinct from 'awaiting_confirmation') then
    new.asked_at := coalesce(new.asked_at, now());
    new.asked_by := coalesce(new.asked_by, auth.uid());
  end if;
  if (new.status = 'confirmed' and old.status is distinct from 'confirmed') then
    new.confirmed_at := coalesce(new.confirmed_at, now());
  end if;
  if (new.status = 'declined' and old.status is distinct from 'declined') then
    new.declined_at := coalesce(new.declined_at, now());
  end if;

  return new;
end;
$$;

create trigger speaking_assignments_guard
  before update on speaking_assignments
  for each row execute function guard_locked_assignment();

-- ============================================================================
-- Rotation pickers (used by auto-create + the UI's "Suggest" button).
-- All "factor in future scheduled" — assignments that aren't declined.
-- ============================================================================

-- Next conductor: bishopric member with the oldest effective last_conducted_date.
create or replace function next_conductor(p_meeting_date date)
returns uuid language sql stable as $$
  with bishopric as (
    select p.id, p.last_conducted_date
    from profiles p
    where p.role = 'bishopric'
  ),
  -- Future commitments push someone to the bottom of the list.
  with_future as (
    select b.id,
      greatest(
        coalesce(b.last_conducted_date, date '1900-01-01'),
        coalesce((
          select max(prg.meeting_date)
          from programs prg
          where prg.conducting_id = b.id
            and prg.meeting_date < p_meeting_date
            and prg.meeting_date >= current_date
        ), date '1900-01-01')
      ) as effective_last
    from bishopric b
  )
  select id from with_future order by effective_last asc, id limit 1;
$$;

-- Next speaker for a category: longest gap, factoring future commitments.
-- exclude_ids lets you avoid picking the same person twice in one program.
create or replace function next_speaker(
  p_meeting_date date,
  p_category speaker_category,
  p_exclude_ids uuid[] default '{}'::uuid[]
)
returns uuid language sql stable as $$
  with candidates as (
    select s.id, s.last_spoke_date
    from speakers s
    join speaker_categories sc on sc.speaker_id = s.id
    where s.is_active = true
      and sc.category = p_category
      and not (s.id = any(p_exclude_ids))
  ),
  with_future as (
    select c.id,
      greatest(
        coalesce(c.last_spoke_date, date '1900-01-01'),
        coalesce((
          select max(prg.meeting_date)
          from speaking_assignments a
          join programs prg on prg.id = a.program_id
          where a.speaker_id = c.id
            and a.status <> 'declined'
            and prg.meeting_date < p_meeting_date
            and prg.meeting_date >= current_date
        ), date '1900-01-01')
      ) as effective_last
    from candidates c
  )
  select id from with_future order by effective_last asc, id limit 1;
$$;

-- Next topic: longest gap since last used (or never). Skip any in exclude_ids.
create or replace function next_topic(
  p_meeting_date date,
  p_exclude_ids uuid[] default '{}'::uuid[]
)
returns uuid language sql stable as $$
  with candidates as (
    select t.id, t.last_used_date
    from topics t
    where t.is_active = true
      and not (t.id = any(p_exclude_ids))
  ),
  with_future as (
    select c.id,
      greatest(
        coalesce(c.last_used_date, date '1900-01-01'),
        coalesce((
          select max(prg.meeting_date)
          from speaking_assignments a
          join programs prg on prg.id = a.program_id
          where a.topic_id = c.id
            and a.status <> 'declined'
            and prg.meeting_date < p_meeting_date
            and prg.meeting_date >= current_date
        ), date '1900-01-01')
      ) as effective_last
    from candidates c
  )
  select id from with_future order by effective_last asc, id limit 1;
$$;

-- ============================================================================
-- Auto-create programs for the next 3 months (idempotent).
-- ============================================================================

create or replace function ensure_next_3_months_programs()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_date date;
  v_end date;
  v_program_id uuid;
  v_conductor uuid;
  v_speaker_first uuid;
  v_speaker_second uuid;
  v_speaker_concluding uuid;
  v_topic_first uuid;
  v_topic_second uuid;
  v_topic_concluding uuid;
  v_created int := 0;
begin
  -- Walk forward to the next Sunday on/after today.
  v_date := current_date + ((7 - extract(dow from current_date)::int) % 7);
  v_end := current_date + interval '3 months';

  while v_date <= v_end loop
    -- Only insert if missing.
    if not exists (select 1 from programs where meeting_date = v_date) then
      v_conductor := next_conductor(v_date);
      v_speaker_first := next_speaker(v_date, 'first');
      v_speaker_second := next_speaker(v_date, 'second', array[v_speaker_first]::uuid[]);
      v_speaker_concluding := next_speaker(v_date, 'concluding', array[v_speaker_first, v_speaker_second]::uuid[]);
      v_topic_first := next_topic(v_date);
      v_topic_second := next_topic(v_date, array[v_topic_first]::uuid[]);
      v_topic_concluding := next_topic(v_date, array[v_topic_first, v_topic_second]::uuid[]);

      insert into programs (meeting_date, conducting_id, status)
        values (v_date, v_conductor, 'draft')
        returning id into v_program_id;

      insert into speaking_assignments (program_id, slot, length_minutes, speaker_id, topic_id) values
        (v_program_id, 'first', 5, v_speaker_first, v_topic_first),
        (v_program_id, 'second', 10, v_speaker_second, v_topic_second),
        (v_program_id, 'concluding', 15, v_speaker_concluding, v_topic_concluding);

      v_created := v_created + 1;
    end if;

    v_date := v_date + interval '7 days';
  end loop;

  return v_created;
end;
$$;

-- ============================================================================
-- Public share access: SECURITY DEFINER function callable by anon.
-- Returns the full program payload as JSON, or NULL if not found / not published.
-- ============================================================================

create or replace function get_published_program(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_result json;
begin
  select to_json(payload) into v_result from (
    select
      p.id,
      p.meeting_date,
      p.presiding,
      p.welcome_text,
      p.brief_reminders,
      p.invocation,
      p.benediction,
      p.chorister,
      p.organist,
      p.releases,
      p.sustainings,
      p.stake_business,
      p.intermediate_hymn_text,
      (select to_json(c) from (
        select pr.full_name, pr.bishopric_position from profiles pr where pr.id = p.conducting_id
      ) c) as conducting,
      (select to_json(h) from (select number, title from hymns where id = p.opening_hymn_id) h) as opening_hymn,
      (select to_json(h) from (select number, title from hymns where id = p.sacrament_hymn_id) h) as sacrament_hymn,
      (select to_json(h) from (select number, title from hymns where id = p.intermediate_hymn_id) h) as intermediate_hymn,
      (select to_json(h) from (select number, title from hymns where id = p.closing_hymn_id) h) as closing_hymn,
      (
        select json_agg(json_build_object(
          'slot', a.slot,
          'length_minutes', a.length_minutes,
          'speaker_name', sp.full_name,
          'topic_title', coalesce(t.title, a.custom_topic_text),
          'topic_description', t.description
        ) order by case a.slot when 'first' then 1 when 'second' then 2 when 'concluding' then 3 end)
        from speaking_assignments a
        left join speakers sp on sp.id = a.speaker_id
        left join topics t on t.id = a.topic_id
        where a.program_id = p.id
      ) as assignments,
      (
        select coalesce(json_agg(json_build_object(
          'title', e.title,
          'description', e.description,
          'event_date', e.event_date
        ) order by e.event_date nulls last), '[]'::json)
        from events e
        where p.meeting_date between e.display_start and e.display_end
      ) as events,
      (select to_json(s) from (
        select branch_name from app_settings where id = 1
      ) s) as settings
    from programs p
    where p.share_token = p_token and p.status = 'published'
  ) payload;

  return v_result;
end;
$$;

grant execute on function get_published_program(text) to anon;
grant execute on function get_published_program(text) to authenticated;

-- ============================================================================
-- RLS — Row-Level Security
-- ============================================================================

alter table profiles enable row level security;
alter table speakers enable row level security;
alter table speaker_categories enable row level security;
alter table topics enable row level security;
alter table hymns enable row level security;
alter table programs enable row level security;
alter table speaking_assignments enable row level security;
alter table speaking_assignment_history enable row level security;
alter table events enable row level security;
alter table app_settings enable row level security;

-- profiles: every authenticated user can read; users update own row;
-- bishopric can update any row (e.g. promote chorister).
create policy "profiles read auth" on profiles
  for select to authenticated using (true);
create policy "profiles update self" on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
create policy "profiles update bishopric" on profiles
  for update to authenticated using (is_bishopric()) with check (is_bishopric());

-- hymns: world-readable (used in public share too); bishopric writes.
create policy "hymns read all" on hymns for select to anon, authenticated using (true);
create policy "hymns bishopric write" on hymns for all to authenticated
  using (is_bishopric()) with check (is_bishopric());

-- speakers: authenticated read; bishopric writes.
create policy "speakers read auth" on speakers for select to authenticated using (true);
create policy "speakers bishopric write" on speakers for all to authenticated
  using (is_bishopric()) with check (is_bishopric());

create policy "speaker_categories read auth" on speaker_categories for select to authenticated using (true);
create policy "speaker_categories bishopric write" on speaker_categories for all to authenticated
  using (is_bishopric()) with check (is_bishopric());

-- topics: authenticated read; bishopric writes.
create policy "topics read auth" on topics for select to authenticated using (true);
create policy "topics bishopric write" on topics for all to authenticated
  using (is_bishopric()) with check (is_bishopric());

-- programs: authenticated read; bishopric writes; chorister can update hymn fields only
-- (guarded by trigger below).
create policy "programs read auth" on programs for select to authenticated using (true);
create policy "programs bishopric all" on programs for all to authenticated
  using (is_bishopric()) with check (is_bishopric());
create policy "programs chorister update" on programs
  for update to authenticated
  using (current_user_role() = 'chorister')
  with check (current_user_role() = 'chorister');

-- Chorister hymn-only guard: prevent any non-hymn field change when role=chorister.
create or replace function guard_chorister_program_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (current_user_role() = 'chorister') then
    if (new.meeting_date is distinct from old.meeting_date
        or new.presiding is distinct from old.presiding
        or new.conducting_id is distinct from old.conducting_id
        or new.welcome_text is distinct from old.welcome_text
        or new.brief_reminders is distinct from old.brief_reminders
        or new.invocation is distinct from old.invocation
        or new.benediction is distinct from old.benediction
        or new.releases is distinct from old.releases
        or new.sustainings is distinct from old.sustainings
        or new.stake_business is distinct from old.stake_business
        or new.status is distinct from old.status
        or new.share_token is distinct from old.share_token) then
      raise exception 'Chorister may only edit hymn fields.';
    end if;
  end if;
  return new;
end;
$$;

create trigger programs_chorister_guard
  before update on programs
  for each row execute function guard_chorister_program_update();

-- speaking_assignments: authenticated read; bishopric writes.
create policy "sa read auth" on speaking_assignments for select to authenticated using (true);
create policy "sa bishopric write" on speaking_assignments for all to authenticated
  using (is_bishopric()) with check (is_bishopric());

create policy "sah read auth" on speaking_assignment_history for select to authenticated using (true);
create policy "sah bishopric write" on speaking_assignment_history for all to authenticated
  using (is_bishopric()) with check (is_bishopric());

-- events: authenticated read; bishopric writes.
create policy "events read auth" on events for select to authenticated using (true);
create policy "events bishopric write" on events for all to authenticated
  using (is_bishopric()) with check (is_bishopric());

-- app_settings: authenticated read; bishopric writes.
create policy "settings read auth" on app_settings for select to authenticated using (true);
create policy "settings bishopric write" on app_settings for all to authenticated
  using (is_bishopric()) with check (is_bishopric());
-- Hymns seed: 1985 LDS Hymnbook (1-341) + new 2024+ hymns released by the Church.
-- Titles drawn from churchofjesuschrist.org / Hymnary.org; verify before printing
-- programs in production — a handful of entries below use the hymn's familiar
-- first line rather than its canonical title, and you may want to adjust.

insert into hymns (id, number, title, hymnal) values
  (1, 1, 'The Morning Breaks', '1985'),
  (2, 2, 'The Spirit of God', '1985'),
  (3, 3, 'Now Let Us Rejoice', '1985'),
  (4, 4, 'Truth Eternal', '1985'),
  (5, 5, 'High on the Mountain Top', '1985'),
  (6, 6, 'Redeemer of Israel', '1985'),
  (7, 7, 'Israel, Israel, God Is Calling', '1985'),
  (8, 8, 'Awake and Arise', '1985'),
  (9, 9, 'Come, Rejoice', '1985'),
  (10, 10, 'Come, Sing to the Lord', '1985'),
  (11, 11, 'What Was Witnessed in the Heavens?', '1985'),
  (12, 12, '''Twas Witnessed in the Morning Sky', '1985'),
  (13, 13, 'An Angel from On High', '1985'),
  (14, 14, 'Sweet Is the Peace the Gospel Brings', '1985'),
  (15, 15, 'I Saw a Mighty Angel Fly', '1985'),
  (16, 16, 'What Glorious Scenes Mine Eyes Behold', '1985'),
  (17, 17, 'Awake, Ye Saints of God, Awake!', '1985'),
  (18, 18, 'The Voice of God Again Is Heard', '1985'),
  (19, 19, 'We Thank Thee, O God, for a Prophet', '1985'),
  (20, 20, 'God of Power, God of Right', '1985'),
  (21, 21, 'Come, Listen to a Prophet''s Voice', '1985'),
  (22, 22, 'We Listen to a Prophet''s Voice', '1985'),
  (23, 23, 'We Ever Pray for Thee', '1985'),
  (24, 24, 'God Bless Our Prophet Dear', '1985'),
  (25, 25, 'Now We''ll Sing with One Accord', '1985'),
  (26, 26, 'Joseph Smith''s First Prayer', '1985'),
  (27, 27, 'Praise to the Man', '1985'),
  (28, 28, 'Saints, Behold How Great Jehovah', '1985'),
  (29, 29, 'A Poor Wayfaring Man of Grief', '1985'),
  (30, 30, 'Come, Come, Ye Saints', '1985'),
  (31, 31, 'O God, Our Help in Ages Past', '1985'),
  (32, 32, 'The Happy Day at Last Has Come', '1985'),
  (33, 33, 'Our Mountain Home So Dear', '1985'),
  (34, 34, 'O Ye Mountains High', '1985'),
  (35, 35, 'For the Strength of the Hills', '1985'),
  (36, 36, 'They, the Builders of the Nation', '1985'),
  (37, 37, 'The Wintry Day, Descending to Its Close', '1985'),
  (38, 38, 'Come, All Ye Saints of Zion', '1985'),
  (39, 39, 'O Saints of Zion', '1985'),
  (40, 40, 'Arise, O Glorious Zion', '1985'),
  (41, 41, 'Let Zion in Her Beauty Rise', '1985'),
  (42, 42, 'Hail to the Brightness of Zion''s Glad Morning!', '1985'),
  (43, 43, 'Zion Stands with Hills Surrounded', '1985'),
  (44, 44, 'Beautiful Zion, Built Above', '1985'),
  (45, 45, 'Lead Me into Life Eternal', '1985'),
  (46, 46, 'Glorious Things of Thee Are Spoken', '1985'),
  (47, 47, 'We Will Sing of Zion', '1985'),
  (48, 48, 'Glorious Things Are Sung of Zion', '1985'),
  (49, 49, 'Adam-ondi-Ahman', '1985'),
  (50, 50, 'Come, Thou Glorious Day of Promise', '1985'),
  (51, 51, 'Sons of Michael, He Approaches', '1985'),
  (52, 52, 'The Day Dawn Is Breaking', '1985'),
  (53, 53, 'Let Earth''s Inhabitants Rejoice', '1985'),
  (54, 54, 'Behold, the Mountain of the Lord', '1985'),
  (55, 55, 'Lo, the Mighty God Appearing!', '1985'),
  (56, 56, 'Softly Beams the Sacred Dawning', '1985'),
  (57, 57, 'We''re Not Ashamed to Own Our Lord', '1985'),
  (58, 58, 'Come, Ye Children of the Lord', '1985'),
  (59, 59, 'Come, O Thou King of Kings', '1985'),
  (60, 60, 'Battle Hymn of the Republic', '1985'),
  (61, 61, 'Raise Your Voices to the Lord', '1985'),
  (62, 62, 'All Creatures of Our God and King', '1985'),
  (63, 63, 'Great King of Heaven', '1985'),
  (64, 64, 'On This Day of Joy and Gladness', '1985'),
  (65, 65, 'Come, All Ye Saints Who Dwell on Earth', '1985'),
  (66, 66, 'Rejoice, the Lord Is King!', '1985'),
  (67, 67, 'Glory to God on High', '1985'),
  (68, 68, 'A Mighty Fortress Is Our God', '1985'),
  (69, 69, 'All Glory, Laud, and Honor', '1985'),
  (70, 70, 'Sing Praise to Him', '1985'),
  (71, 71, 'With Songs of Praise', '1985'),
  (72, 72, 'Praise to the Lord, the Almighty', '1985'),
  (73, 73, 'Praise the Lord with Heart and Voice', '1985'),
  (74, 74, 'Praise Ye the Lord', '1985'),
  (75, 75, 'In Hymns of Praise', '1985'),
  (76, 76, 'God of Our Fathers, We Come unto Thee', '1985'),
  (77, 77, 'Great Is the Lord', '1985'),
  (78, 78, 'God of Our Fathers, Whose Almighty Hand', '1985'),
  (79, 79, 'With All the Power of Heart and Tongue', '1985'),
  (80, 80, 'God of Our Fathers, Known of Old', '1985'),
  (81, 81, 'Press Forward, Saints', '1985'),
  (82, 82, 'For All the Saints', '1985'),
  (83, 83, 'Guide Us, O Thou Great Jehovah', '1985'),
  (84, 84, 'Faith of Our Fathers', '1985'),
  (85, 85, 'How Firm a Foundation', '1985'),
  (86, 86, 'How Great Thou Art', '1985'),
  (87, 87, 'God Is Love', '1985'),
  (88, 88, 'Great God, Attend While Zion Sings', '1985'),
  (89, 89, 'The Lord Is My Light', '1985'),
  (90, 90, 'From All That Dwell below the Skies', '1985'),
  (91, 91, 'Father, Thy Children to Thee Now Raise', '1985'),
  (92, 92, 'For the Beauty of the Earth', '1985'),
  (93, 93, 'Prayer of Thanksgiving', '1985'),
  (94, 94, 'Come, Ye Thankful People', '1985'),
  (95, 95, 'Now Thank We All Our God', '1985'),
  (96, 96, 'Dearest Children, God Is Near You', '1985'),
  (97, 97, 'Lead, Kindly Light', '1985'),
  (98, 98, 'I Need Thee Every Hour', '1985'),
  (99, 99, 'Nearer, Dear Savior, to Thee', '1985'),
  (100, 100, 'Nearer, My God, to Thee', '1985'),
  (101, 101, 'Guide Me to Thee', '1985'),
  (102, 102, 'Jesus, Lover of My Soul', '1985'),
  (103, 103, 'Precious Savior, Dear Redeemer', '1985'),
  (104, 104, 'Jesus, Savior, Pilot Me', '1985'),
  (105, 105, 'Master, the Tempest Is Raging', '1985'),
  (106, 106, 'God Speed the Right', '1985'),
  (107, 107, 'Lord, Accept Our True Devotion', '1985'),
  (108, 108, 'The Lord Is My Shepherd', '1985'),
  (109, 109, 'The Lord My Pasture Will Prepare', '1985'),
  (110, 110, 'Cast Thy Burden upon the Lord', '1985'),
  (111, 111, 'Rock of Ages', '1985'),
  (112, 112, 'Savior, Redeemer of My Soul', '1985'),
  (113, 113, 'Our Savior''s Love', '1985'),
  (114, 114, 'Come unto Him', '1985'),
  (115, 115, 'Come, Ye Disconsolate', '1985'),
  (116, 116, 'Come, Follow Me', '1985'),
  (117, 117, 'Come unto Jesus', '1985'),
  (118, 118, 'Ye Simple Souls Who Stray', '1985'),
  (119, 119, 'Come, We That Love the Lord', '1985'),
  (120, 120, 'Lean on My Ample Arm', '1985'),
  (121, 121, 'I''m a Pilgrim, I''m a Stranger', '1985'),
  (122, 122, 'Though Deepening Trials', '1985'),
  (123, 123, 'Oh, May My Soul Commune with Thee', '1985'),
  (124, 124, 'Be Still, My Soul', '1985'),
  (125, 125, 'How Gentle God''s Commands', '1985'),
  (126, 126, 'How Long, O Lord Most Holy and True', '1985'),
  (127, 127, 'Does the Journey Seem Long?', '1985'),
  (128, 128, 'When Faith Endures', '1985'),
  (129, 129, 'Where Can I Turn for Peace?', '1985'),
  (130, 130, 'Be Thou Humble', '1985'),
  (131, 131, 'More Holiness Give Me', '1985'),
  (132, 132, 'God Is in His Holy Temple', '1985'),
  (133, 133, 'Father in Heaven', '1985'),
  (134, 134, 'I Believe in Christ', '1985'),
  (135, 135, 'My Redeemer Lives', '1985'),
  (136, 136, 'I Know That My Redeemer Lives', '1985'),
  (137, 137, 'Testimony', '1985'),
  (138, 138, 'Bless Our Fast, We Pray', '1985'),
  (139, 139, 'In Fasting We Approach Thee', '1985'),
  (140, 140, 'Did You Think to Pray?', '1985'),
  (141, 141, 'Jesus, the Very Thought of Thee', '1985'),
  (142, 142, 'Sweet Hour of Prayer', '1985'),
  (143, 143, 'Let the Holy Spirit Guide', '1985'),
  (144, 144, 'Secret Prayer', '1985'),
  (145, 145, 'Prayer Is the Soul''s Sincere Desire', '1985'),
  (146, 146, 'Gently Raise the Sacred Strain', '1985'),
  (147, 147, 'Sweet Is the Work', '1985'),
  (148, 148, 'Sabbath Day', '1985'),
  (149, 149, 'As the Dew from Heaven Distilling', '1985'),
  (150, 150, 'O Thou Kind and Gracious Father', '1985'),
  (151, 151, 'We Meet, Dear Lord', '1985'),
  (152, 152, 'God Be with You Till We Meet Again', '1985'),
  (153, 153, 'Lord, We Ask Thee Ere We Part', '1985'),
  (154, 154, 'Father, This Hour Has Been One of Joy', '1985'),
  (155, 155, 'We Have Partaken of Thy Love', '1985'),
  (156, 156, 'Sing We Now at Parting', '1985'),
  (157, 157, 'Thy Spirit, Lord, Has Stirred Our Souls', '1985'),
  (158, 158, 'Before Thee, Lord, I Bow My Head', '1985'),
  (159, 159, 'Now the Day Is Over', '1985'),
  (160, 160, 'Softly Now the Light of Day', '1985'),
  (161, 161, 'The Lord Be with Us', '1985'),
  (162, 162, 'Lord, We Come Before Thee Now', '1985'),
  (163, 163, 'Lord, Dismiss Us with Thy Blessing', '1985'),
  (164, 164, 'Great God, to Thee My Evening Song', '1985'),
  (165, 165, 'Abide with Me; ''Tis Eventide', '1985'),
  (166, 166, 'Abide with Me!', '1985'),
  (167, 167, 'Come, Let Us Sing an Evening Hymn', '1985'),
  (168, 168, 'As the Shadows Fall', '1985'),
  (169, 169, 'As Now We Take the Sacrament', '1985'),
  (170, 170, 'God, Our Father, Hear Us Pray', '1985'),
  (171, 171, 'With Humble Heart', '1985'),
  (172, 172, 'In Humility, Our Savior', '1985'),
  (173, 173, 'While of These Emblems We Partake', '1985'),
  (174, 174, 'While of These Emblems We Partake', '1985'),
  (175, 175, 'O God, the Eternal Father', '1985'),
  (176, 176, '''Tis Sweet to Sing the Matchless Love', '1985'),
  (177, 177, '''Tis Sweet to Sing the Matchless Love', '1985'),
  (178, 178, 'O Lord of Hosts', '1985'),
  (179, 179, 'Again, Our Dear Redeeming Lord', '1985'),
  (180, 180, 'Father in Heaven, We Do Believe', '1985'),
  (181, 181, 'Jesus of Nazareth, Savior and King', '1985'),
  (182, 182, 'We''ll Sing All Hail to Jesus'' Name', '1985'),
  (183, 183, 'In Remembrance of Thy Suffering', '1985'),
  (184, 184, 'Upon the Cross of Calvary', '1985'),
  (185, 185, 'Reverently and Meekly Now', '1985'),
  (186, 186, 'Again We Meet around the Board', '1985'),
  (187, 187, 'God Loved Us, So He Sent His Son', '1985'),
  (188, 188, 'Thy Will, O Lord, Be Done', '1985'),
  (189, 189, 'O Thou, Before the World Began', '1985'),
  (190, 190, 'In Memory of the Crucified', '1985'),
  (191, 191, 'Behold the Great Redeemer Die', '1985'),
  (192, 192, 'He Died! The Great Redeemer Died', '1985'),
  (193, 193, 'I Stand All Amazed', '1985'),
  (194, 194, 'There Is a Green Hill Far Away', '1985'),
  (195, 195, 'How Great the Wisdom and the Love', '1985'),
  (196, 196, 'Jesus, Once of Humble Birth', '1985'),
  (197, 197, 'O Savior, Thou Who Wearest a Crown', '1985'),
  (198, 198, 'That Easter Morn', '1985'),
  (199, 199, 'He Is Risen!', '1985'),
  (200, 200, 'Christ the Lord Is Risen Today', '1985'),
  (201, 201, 'Joy to the World', '1985'),
  (202, 202, 'Oh, Come, All Ye Faithful', '1985'),
  (203, 203, 'Angels We Have Heard on High', '1985'),
  (204, 204, 'Silent Night', '1985'),
  (205, 205, 'Once in Royal David''s City', '1985'),
  (206, 206, 'Away in a Manger', '1985'),
  (207, 207, 'It Came upon the Midnight Clear', '1985'),
  (208, 208, 'O Little Town of Bethlehem', '1985'),
  (209, 209, 'Hark! The Herald Angels Sing', '1985'),
  (210, 210, 'With Wondering Awe', '1985'),
  (211, 211, 'While Shepherds Watched Their Flocks', '1985'),
  (212, 212, 'Far, Far Away on Judea''s Plains', '1985'),
  (213, 213, 'The First Noel', '1985'),
  (214, 214, 'I Heard the Bells on Christmas Day', '1985'),
  (215, 215, 'Ring Out, Wild Bells', '1985'),
  (216, 216, 'We Are Sowing', '1985'),
  (217, 217, 'Come, Let Us Anew', '1985'),
  (218, 218, 'We Give Thee but Thine Own', '1985'),
  (219, 219, 'Because I Have Been Given Much', '1985'),
  (220, 220, 'Lord, I Would Follow Thee', '1985'),
  (221, 221, 'Dear to the Heart of the Shepherd', '1985'),
  (222, 222, 'Hear Thou Our Hymn, O Lord', '1985'),
  (223, 223, 'Have I Done Any Good?', '1985'),
  (224, 224, 'I Have Work Enough to Do', '1985'),
  (225, 225, 'We Are Marching On to Glory', '1985'),
  (226, 226, 'Improve the Shining Moments', '1985'),
  (227, 227, 'There Is Sunshine in My Soul Today', '1985'),
  (228, 228, 'You Can Make the Pathway Bright', '1985'),
  (229, 229, 'Today, While the Sun Shines', '1985'),
  (230, 230, 'Scatter Sunshine', '1985'),
  (231, 231, 'Father, Cheer Our Souls Tonight', '1985'),
  (232, 232, 'Let Us Oft Speak Kind Words', '1985'),
  (233, 233, 'Nay, Speak No Ill', '1985'),
  (234, 234, 'Jesus, Mighty King in Zion', '1985'),
  (235, 235, 'Should You Feel Inclined to Censure', '1985'),
  (236, 236, 'Lord, Accept into Thy Kingdom', '1985'),
  (237, 237, 'Do What Is Right', '1985'),
  (238, 238, 'Behold Thy Sons and Daughters, Lord', '1985'),
  (239, 239, 'Choose the Right', '1985'),
  (240, 240, 'Know This, That Every Soul Is Free', '1985'),
  (241, 241, 'Count Your Blessings', '1985'),
  (242, 242, 'Praise God, from Whom All Blessings Flow', '1985'),
  (243, 243, 'Let Us All Press On', '1985'),
  (244, 244, 'Come Along, Come Along', '1985'),
  (245, 245, 'This House We Dedicate to Thee', '1985'),
  (246, 246, 'Onward, Christian Soldiers', '1985'),
  (247, 247, 'We Love Thy House, O God', '1985'),
  (248, 248, 'Up, Awake, Ye Defenders of Zion', '1985'),
  (249, 249, 'Called to Serve', '1985'),
  (250, 250, 'We Are All Enlisted', '1985'),
  (251, 251, 'Behold! A Royal Army', '1985'),
  (252, 252, 'Put Your Shoulder to the Wheel', '1985'),
  (253, 253, 'Like Ten Thousand Legions Marching', '1985'),
  (254, 254, 'True to the Faith', '1985'),
  (255, 255, 'Carry On', '1985'),
  (256, 256, 'As Zion''s Youth in Latter Days', '1985'),
  (257, 257, 'Rejoice! A Glorious Sound Is Heard', '1985'),
  (258, 258, 'O Thou Rock of Our Salvation', '1985'),
  (259, 259, 'Hope of Israel', '1985'),
  (260, 260, 'Who''s on the Lord''s Side?', '1985'),
  (261, 261, 'Thy Servants Are Prepared', '1985'),
  (262, 262, 'Go, Ye Messengers of Glory', '1985'),
  (263, 263, 'Go Forth with Faith', '1985'),
  (264, 264, 'Hark, All Ye Nations!', '1985'),
  (265, 265, 'Arise, O God, and Shine', '1985'),
  (266, 266, 'The Time Is Far Spent', '1985'),
  (267, 267, 'How Wondrous and Great', '1985'),
  (268, 268, 'Come, All Whose Souls Are Lighted', '1985'),
  (269, 269, 'Jehovah, Lord of Heaven and Earth', '1985'),
  (270, 270, 'I''ll Go Where You Want Me to Go', '1985'),
  (271, 271, 'Oh, Holy Words of Truth and Love', '1985'),
  (272, 272, 'Oh Say, What Is Truth?', '1985'),
  (273, 273, 'Truth Reflects upon Our Senses', '1985'),
  (274, 274, 'The Iron Rod', '1985'),
  (275, 275, 'A Voice Hath Spoken from the Dust', '1985'),
  (276, 276, 'Come Away to the Sunday School', '1985'),
  (277, 277, 'As I Search the Holy Scriptures', '1985'),
  (278, 278, 'Thanks for the Sabbath School', '1985'),
  (279, 279, 'Thy Holy Word', '1985'),
  (280, 280, 'Welcome, Welcome, Sabbath Morning', '1985'),
  (281, 281, 'Help Me Teach with Inspiration', '1985'),
  (282, 282, 'We Meet Again in Sabbath School', '1985'),
  (283, 283, 'The Glorious Gospel Light Has Shone', '1985'),
  (284, 284, 'If You Could Hie to Kolob', '1985'),
  (285, 285, 'God Moves in a Mysterious Way', '1985'),
  (286, 286, 'Oh, What Songs of the Heart', '1985'),
  (287, 287, 'Rise, Ye Saints, and Temples Enter', '1985'),
  (288, 288, 'How Beautiful Thy Temples, Lord', '1985'),
  (289, 289, 'Holy Temples on Mount Zion', '1985'),
  (290, 290, 'Rejoice, Ye Saints of Latter Days', '1985'),
  (291, 291, 'Turn Your Hearts', '1985'),
  (292, 292, 'O My Father', '1985'),
  (293, 293, 'Each Life That Touches Ours for Good', '1985'),
  (294, 294, 'Love at Home', '1985'),
  (295, 295, 'O Love That Glorifies the Son', '1985'),
  (296, 296, 'Our Father, by Whose Name', '1985'),
  (297, 297, 'From Homes of Saints Glad Songs Arise', '1985'),
  (298, 298, 'Home Can Be a Heaven on Earth', '1985'),
  (299, 299, 'Children of Our Heavenly Father', '1985'),
  (300, 300, 'Families Can Be Together Forever', '1985'),
  (301, 301, 'I Am a Child of God', '1985'),
  (302, 302, 'I Know My Father Lives', '1985'),
  (303, 303, 'Keep the Commandments', '1985'),
  (304, 304, 'Teach Me to Walk in the Light', '1985'),
  (305, 305, 'The Light Divine', '1985'),
  (306, 306, 'God''s Daily Care', '1985'),
  (307, 307, 'In Our Lovely Deseret', '1985'),
  (308, 308, 'Love One Another', '1985'),
  (309, 309, 'As Sisters in Zion', '1985'),
  (310, 310, 'A Key Was Turned in Latter Days', '1985'),
  (311, 311, 'We Meet Again as Sisters', '1985'),
  (312, 312, 'We Ever Pray for Thee', '1985'),
  (313, 313, 'God Is Love', '1985'),
  (314, 314, 'How Gentle God''s Commands', '1985'),
  (315, 315, 'Jesus, the Very Thought of Thee', '1985'),
  (316, 316, 'The Lord Is My Shepherd', '1985'),
  (317, 317, 'Sweet Is the Work', '1985'),
  (318, 318, 'Love at Home', '1985'),
  (319, 319, 'Ye Elders of Israel', '1985'),
  (320, 320, 'The Priesthood of Our Lord', '1985'),
  (321, 321, 'Ye Who Are Called to Labor', '1985'),
  (322, 322, 'Come, All Ye Sons of God', '1985'),
  (323, 323, 'Rise Up, O Men of God', '1985'),
  (324, 324, 'Rise Up, O Men of God', '1985'),
  (325, 325, 'See the Mighty Priesthood Gathered', '1985'),
  (326, 326, 'Come, Come, Ye Saints', '1985'),
  (327, 327, 'Go, Ye Messengers of Heaven', '1985'),
  (328, 328, 'An Angel from on High', '1985'),
  (329, 329, 'Thy Servants Are Prepared', '1985'),
  (330, 330, 'See, the Mighty Angel Flying', '1985'),
  (331, 331, 'Oh Say, What Is Truth?', '1985'),
  (332, 332, 'Come, O Thou King of Kings', '1985'),
  (333, 333, 'High on the Mountain Top', '1985'),
  (334, 334, 'I Need Thee Every Hour', '1985'),
  (335, 335, 'Brightly Beams Our Father''s Mercy', '1985'),
  (336, 336, 'School Thy Feelings', '1985'),
  (337, 337, 'O Home Beloved', '1985'),
  (338, 338, 'America the Beautiful', '1985'),
  (339, 339, 'My Country, ''Tis of Thee', '1985'),
  (340, 340, 'The Star-Spangled Banner', '1985'),
  (341, 341, 'God Save the King', '1985');

-- New 2024+ hymns released by the Church (Sept 2024 batch). Numbers above 341
-- are placeholders for app sorting; verify against the official list when more
-- are released.
insert into hymns (id, number, title, hymnal) values
  (1001, 1001, 'His Eye Is on the Sparrow', 'new'),
  (1002, 1002, 'I Will Walk with Jesus', 'new'),
  (1003, 1003, 'Holding Hands Around the World', 'new'),
  (1004, 1004, 'Bread of Life, Living Water', 'new'),
  (1005, 1005, 'When the Savior Comes Again', 'new'),
  (1006, 1006, 'As Bread Is Broken', 'new'),
  (1007, 1007, 'Gethsemane', 'new'),
  (1008, 1008, 'Come, Thou Fount of Every Blessing', 'new'),
  (1009, 1009, 'Amazing Grace', 'new'),
  (1010, 1010, 'I Believe in Christ (Stand-alone)', 'new');
