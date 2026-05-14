-- ============================================================================
-- Rameumptom multi-tenant schema (v2)
-- ============================================================================
-- This is the FRESH BUILD for the marketed multi-unit version. Paste it once
-- into the SQL editor of a brand-new Supabase project. Idempotent — safe to
-- re-run during development.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
do $$ begin
  create type unit_type as enum ('ward', 'branch');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_role as enum ('leader', 'chorister');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leader_position as enum ('president', 'first_counselor', 'second_counselor', 'clerk');
exception when duplicate_object then null; end $$;

do $$ begin
  create type speaker_category as enum ('first', 'second', 'concluding');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assignment_slot as enum ('first', 'second', 'concluding');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assignment_status as enum ('not_yet_asked', 'awaiting_confirmation', 'confirmed', 'declined');
exception when duplicate_object then null; end $$;

do $$ begin
  create type program_status as enum ('draft', 'published');
exception when duplicate_object then null; end $$;

do $$ begin
  create type meeting_type as enum ('regular', 'fast_sunday', 'no_services');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- UNITS (the tenant)
-- ---------------------------------------------------------------------------
create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type unit_type not null default 'branch',
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- per-unit settings (no separate app_settings table; fewer joins)
  default_welcome_text text not null default 'Welcome to sacrament meeting. We''re glad you''re here.',
  assignment_paper_template text not null default 'Thank you for your willingness to serve. Please prepare a talk based on the topic above. If you have any questions, please contact a member of the leadership.',
  unit_business_footer text,
  calendar_ics_url text
);

-- ---------------------------------------------------------------------------
-- PROFILES (extends auth.users)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  active_unit_id uuid references units(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Auto-insert a row on new auth user (signup trigger).
create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- UNIT_MEMBERS (many-to-many between users and units, with role + position)
-- ---------------------------------------------------------------------------
create table if not exists unit_members (
  unit_id uuid not null references units(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null,
  position leader_position,
  last_conducted_date date,
  created_at timestamptz not null default now(),
  primary key (unit_id, user_id),
  -- Position must be set iff role is leader.
  constraint position_only_for_leaders check (
    (role = 'leader') or (role = 'chorister' and position is null)
  ),
  -- Each position is unique within a unit; multiple NULL positions OK.
  unique (unit_id, position)
);

-- ---------------------------------------------------------------------------
-- SPEAKERS (per unit)
-- ---------------------------------------------------------------------------
create table if not exists speakers (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  notes text,
  is_active boolean not null default true,
  last_spoke_date date,
  historical_dates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists speakers_unit_idx on speakers(unit_id);
create index if not exists speakers_last_spoke_idx
  on speakers(unit_id, last_spoke_date nulls first);

create table if not exists speaker_categories (
  speaker_id uuid not null references speakers(id) on delete cascade,
  category speaker_category not null,
  primary key (speaker_id, category)
);

-- ---------------------------------------------------------------------------
-- TOPICS (per unit)
-- ---------------------------------------------------------------------------
create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  title text not null,
  description text,
  is_active boolean not null default true,
  last_used_date date,
  created_at timestamptz not null default now()
);

create index if not exists topics_unit_idx on topics(unit_id);

create table if not exists topic_categories (
  topic_id uuid not null references topics(id) on delete cascade,
  category speaker_category not null,
  primary key (topic_id, category)
);

-- ---------------------------------------------------------------------------
-- HYMNS (shared across all units — universal LDS hymnbook)
-- ---------------------------------------------------------------------------
create table if not exists hymns (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique,
  title text not null
);

-- ---------------------------------------------------------------------------
-- PROGRAMS (per unit)
-- ---------------------------------------------------------------------------
create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  meeting_date date not null,
  status program_status not null default 'draft',
  meeting_type meeting_type not null default 'regular',
  meeting_type_label text,
  share_token text unique default replace(gen_random_uuid()::text, '-', ''),
  -- Leadership pickers
  conducting_id uuid references auth.users(id) on delete set null,
  presiding text,
  -- Free-text content
  welcome_text text,
  brief_reminders text,
  invocation text,
  benediction text,
  chorister text,
  organist text,
  -- Hymns
  opening_hymn_id uuid references hymns(id) on delete set null,
  sacrament_hymn_id uuid references hymns(id) on delete set null,
  intermediate_hymn_id uuid references hymns(id) on delete set null,
  intermediate_hymn_text text,
  closing_hymn_id uuid references hymns(id) on delete set null,
  -- Business sections
  releases text,
  sustainings text,
  move_in_welcomes text,
  aaronic_sustainings text,
  baptism_confirmation text,
  baby_blessing text,
  stake_business text,
  ward_business_releases boolean not null default false,
  ward_business_sustainings boolean not null default false,
  ward_business_move_in_welcomes boolean not null default false,
  ward_business_aaronic_sustainings boolean not null default false,
  ward_business_baptism_confirmation boolean not null default false,
  ward_business_baby_blessing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, meeting_date)
);

create index if not exists programs_unit_idx on programs(unit_id);
create index if not exists programs_meeting_date_idx on programs(unit_id, meeting_date);

-- updated_at trigger
create or replace function bump_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists programs_updated_at on programs;
create trigger programs_updated_at before update on programs
  for each row execute function bump_updated_at();

drop trigger if exists units_updated_at on units;
create trigger units_updated_at before update on units
  for each row execute function bump_updated_at();

-- ---------------------------------------------------------------------------
-- SPEAKING_ASSIGNMENTS
-- ---------------------------------------------------------------------------
create table if not exists speaking_assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  slot assignment_slot not null,
  length_minutes integer not null default 10,
  speaker_id uuid references speakers(id) on delete set null,
  custom_speaker_name text,
  topic_id uuid references topics(id) on delete set null,
  custom_topic_text text,
  notes text,
  status assignment_status not null default 'not_yet_asked',
  asked_at timestamptz,
  asked_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  declined_at timestamptz,
  invited_at timestamptz,
  reminded_at timestamptz,
  last_response text check (last_response in ('confirmed', 'declined')),
  responded_at timestamptz,
  confirmation_source text check (confirmation_source in ('self', 'manual')),
  confirm_token uuid unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (program_id, slot)
);

create index if not exists speaking_assignments_program_idx on speaking_assignments(program_id);

-- ---------------------------------------------------------------------------
-- EVENTS (per unit)
-- ---------------------------------------------------------------------------
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  title text not null,
  description text,
  event_date date,
  display_start date,
  display_end date,
  as_brief_reminder boolean not null default false,
  external_uid text,
  created_at timestamptz not null default now()
);

create index if not exists events_unit_idx on events(unit_id);
create index if not exists events_display_idx on events(unit_id, display_start, display_end);

-- ---------------------------------------------------------------------------
-- UNIT_INVITES — pending invitations to join a unit
-- ---------------------------------------------------------------------------
create table if not exists unit_invites (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  email text not null,
  role member_role not null,
  position leader_position,
  invited_by uuid not null references auth.users(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  unique (unit_id, email)
);

-- ============================================================================
-- RLS HELPERS
-- ============================================================================

create or replace function is_unit_member(p_unit_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from unit_members
    where unit_id = p_unit_id and user_id = auth.uid()
  );
$$;

create or replace function is_unit_leader(p_unit_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from unit_members
    where unit_id = p_unit_id and user_id = auth.uid() and role = 'leader'
  );
$$;

create or replace function current_active_unit()
returns uuid language sql security definer stable set search_path = public as $$
  select active_unit_id from profiles where id = auth.uid();
$$;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

alter table units            enable row level security;
alter table profiles         enable row level security;
alter table unit_members     enable row level security;
alter table speakers         enable row level security;
alter table speaker_categories enable row level security;
alter table topics           enable row level security;
alter table topic_categories enable row level security;
alter table hymns            enable row level security;
alter table programs         enable row level security;
alter table speaking_assignments enable row level security;
alter table events           enable row level security;
alter table unit_invites     enable row level security;

-- UNITS: members can read; owner / leaders can update.
create policy "units read members" on units for select to authenticated
  using (is_unit_member(id));
create policy "units update leaders" on units for update to authenticated
  using (is_unit_leader(id)) with check (is_unit_leader(id));
-- Anyone authenticated can create a new unit (becomes owner + leader).
create policy "units insert any auth" on units for insert to authenticated
  with check (owner_id = auth.uid());

-- PROFILES: read all profiles in any unit you share; update own.
create policy "profiles read self" on profiles for select to authenticated
  using (id = auth.uid());
create policy "profiles read shared unit" on profiles for select to authenticated
  using (
    exists (
      select 1
      from unit_members me
      join unit_members them on them.unit_id = me.unit_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
  );
create policy "profiles update self" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- UNIT_MEMBERS: read if you're in the unit; manage if you're a leader.
create policy "unit_members read members" on unit_members for select to authenticated
  using (is_unit_member(unit_id));
create policy "unit_members write leaders" on unit_members for all to authenticated
  using (is_unit_leader(unit_id)) with check (is_unit_leader(unit_id));

-- SPEAKERS: members read; leaders write.
create policy "speakers read members" on speakers for select to authenticated
  using (is_unit_member(unit_id));
create policy "speakers write leaders" on speakers for all to authenticated
  using (is_unit_leader(unit_id)) with check (is_unit_leader(unit_id));

-- SPEAKER_CATEGORIES inherits via the speaker.
create policy "speaker_categories read members" on speaker_categories for select to authenticated
  using (exists (select 1 from speakers s where s.id = speaker_id and is_unit_member(s.unit_id)));
create policy "speaker_categories write leaders" on speaker_categories for all to authenticated
  using (exists (select 1 from speakers s where s.id = speaker_id and is_unit_leader(s.unit_id)))
  with check (exists (select 1 from speakers s where s.id = speaker_id and is_unit_leader(s.unit_id)));

-- TOPICS
create policy "topics read members" on topics for select to authenticated
  using (is_unit_member(unit_id));
create policy "topics write leaders" on topics for all to authenticated
  using (is_unit_leader(unit_id)) with check (is_unit_leader(unit_id));

create policy "topic_categories read members" on topic_categories for select to authenticated
  using (exists (select 1 from topics t where t.id = topic_id and is_unit_member(t.unit_id)));
create policy "topic_categories write leaders" on topic_categories for all to authenticated
  using (exists (select 1 from topics t where t.id = topic_id and is_unit_leader(t.unit_id)))
  with check (exists (select 1 from topics t where t.id = topic_id and is_unit_leader(t.unit_id)));

-- HYMNS (shared) — world readable; only service-role can write (via admin).
create policy "hymns read all" on hymns for select to anon, authenticated using (true);

-- PROGRAMS
create policy "programs read members" on programs for select to authenticated
  using (is_unit_member(unit_id));
create policy "programs write leaders" on programs for all to authenticated
  using (is_unit_leader(unit_id)) with check (is_unit_leader(unit_id));
-- Chorister-only update for hymn fields is enforced by trigger below.
create policy "programs hymn update chorister" on programs for update to authenticated
  using (
    is_unit_member(unit_id)
    and exists (select 1 from unit_members
      where unit_id = programs.unit_id
        and user_id = auth.uid()
        and role = 'chorister')
  )
  with check (true);

-- SPEAKING_ASSIGNMENTS via program.
create policy "assignments read members" on speaking_assignments for select to authenticated
  using (exists (select 1 from programs p where p.id = program_id and is_unit_member(p.unit_id)));
create policy "assignments write leaders" on speaking_assignments for all to authenticated
  using (exists (select 1 from programs p where p.id = program_id and is_unit_leader(p.unit_id)))
  with check (exists (select 1 from programs p where p.id = program_id and is_unit_leader(p.unit_id)));

-- EVENTS
create policy "events read members" on events for select to authenticated
  using (is_unit_member(unit_id));
create policy "events write leaders" on events for all to authenticated
  using (is_unit_leader(unit_id)) with check (is_unit_leader(unit_id));

-- UNIT_INVITES: leaders manage; invitees can look up by token (via SECURITY DEFINER fn).
create policy "unit_invites leaders" on unit_invites for all to authenticated
  using (is_unit_leader(unit_id)) with check (is_unit_leader(unit_id));

-- ============================================================================
-- GUARD TRIGGERS
-- ============================================================================

-- Chorister can only edit hymn fields on a program. Any other column change
-- by a chorister raises an exception.
create or replace function guard_chorister_program_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role member_role;
begin
  select role into v_role from unit_members
    where unit_id = new.unit_id and user_id = auth.uid();
  if v_role = 'chorister' then
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

drop trigger if exists guard_chorister_programs on programs;
create trigger guard_chorister_programs before update on programs
  for each row execute function guard_chorister_program_update();

-- Speaking-assignment status flow + speaker-swap safety.
create or replace function guard_locked_assignment()
returns trigger language plpgsql as $$
begin
  -- Swapping a speaker on a locked row resets status to not_yet_asked.
  if (old.status <> 'not_yet_asked'
      and (old.speaker_id is distinct from new.speaker_id
           or coalesce(old.custom_speaker_name, '') <> coalesce(new.custom_speaker_name, ''))) then
    new.status := 'not_yet_asked';
  end if;
  if (new.status = 'not_yet_asked' and old.status <> 'not_yet_asked') then
    new.asked_at := null; new.asked_by := null;
    new.confirmed_at := null; new.declined_at := null;
    new.confirmation_source := null; new.reminded_at := null;
  end if;
  if (new.status = 'awaiting_confirmation' and old.status is distinct from 'awaiting_confirmation') then
    new.asked_at := coalesce(new.asked_at, now());
    new.asked_by := coalesce(new.asked_by, auth.uid());
  end if;
  if (new.status = 'confirmed' and old.status is distinct from 'confirmed') then
    new.confirmed_at := coalesce(new.confirmed_at, now());
    if (new.confirmation_source is not distinct from old.confirmation_source) then
      new.confirmation_source := 'manual';
    end if;
  end if;
  if (new.status = 'declined' and old.status is distinct from 'declined') then
    new.declined_at := coalesce(new.declined_at, now());
    if (new.confirmation_source is not distinct from old.confirmation_source) then
      new.confirmation_source := 'manual';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_assignments on speaking_assignments;
create trigger guard_assignments before update on speaking_assignments
  for each row execute function guard_locked_assignment();

-- ============================================================================
-- ROTATION FUNCTIONS (all unit-scoped)
-- ============================================================================

create or replace function recompute_speaker_last_spoke(p_speaker_id uuid)
returns void language sql as $$
  update speakers s set last_spoke_date = greatest(
    (select max(p.meeting_date)
       from speaking_assignments a
       join programs p on p.id = a.program_id
       where a.speaker_id = p_speaker_id
         and p.meeting_date <= current_date),
    (select max((d)::date)
       from jsonb_array_elements_text(s.historical_dates) as d
       where (d)::date <= current_date)
  )
  where s.id = p_speaker_id;
$$;

create or replace function recompute_topic_last_used(p_topic_id uuid)
returns void language sql as $$
  update topics t set last_used_date = (
    select max(p.meeting_date) from speaking_assignments a
    join programs p on p.id = a.program_id
    where a.topic_id = p_topic_id and p.meeting_date <= current_date
  )
  where t.id = p_topic_id;
$$;

-- Public read of a published program by share_token.
create or replace function get_published_program(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_result json;
begin
  select to_json(payload) into v_result from (
    select
      p.id, p.meeting_date, p.presiding, p.welcome_text, p.brief_reminders,
      p.invocation, p.benediction, p.chorister, p.organist,
      p.releases, p.sustainings, p.move_in_welcomes, p.aaronic_sustainings,
      p.baptism_confirmation, p.baby_blessing, p.stake_business,
      p.ward_business_releases, p.ward_business_sustainings,
      p.ward_business_move_in_welcomes, p.ward_business_aaronic_sustainings,
      p.ward_business_baptism_confirmation, p.ward_business_baby_blessing,
      p.intermediate_hymn_text, p.meeting_type, p.meeting_type_label,
      u.name as branch_name,
      u.type as unit_type,
      u.unit_business_footer as ward_business_footer,
      (select to_json(c) from (
        select pr.full_name, um.position as bishopric_position
        from unit_members um join profiles pr on pr.id = um.user_id
        where um.unit_id = p.unit_id and um.user_id = p.conducting_id
      ) c) as conducting,
      (select to_json(h) from (select number, title from hymns where id = p.opening_hymn_id) h) as opening_hymn,
      (select to_json(h) from (select number, title from hymns where id = p.sacrament_hymn_id) h) as sacrament_hymn,
      (select to_json(h) from (select number, title from hymns where id = p.intermediate_hymn_id) h) as intermediate_hymn,
      (select to_json(h) from (select number, title from hymns where id = p.closing_hymn_id) h) as closing_hymn,
      (select coalesce(json_agg(a_row), '[]'::json) from (
        select sa.slot, sa.length_minutes,
          coalesce(s.full_name, sa.custom_speaker_name) as speaker_name,
          (sa.speaker_id is null and sa.custom_speaker_name is not null) as is_stake_speaker,
          t.title as topic_title, t.description as topic_description
        from speaking_assignments sa
        left join speakers s on s.id = sa.speaker_id
        left join topics t on t.id = sa.topic_id
        where sa.program_id = p.id
        order by case sa.slot when 'first' then 1 when 'second' then 2 else 3 end
      ) a_row) as assignments,
      (select coalesce(json_agg(e_row), '[]'::json) from (
        select title, description, event_date from events
        where unit_id = p.unit_id
          and as_brief_reminder = false
          and display_start <= p.meeting_date
          and display_end >= p.meeting_date
        order by event_date asc nulls last
      ) e_row) as events,
      (select coalesce(json_agg(e_row), '[]'::json) from (
        select title, description, event_date from events
        where unit_id = p.unit_id
          and as_brief_reminder = true
          and event_date >= p.meeting_date
          and event_date <= (p.meeting_date + interval '32 days')::date
        order by event_date asc
      ) e_row) as brief_reminder_events
    from programs p
    join units u on u.id = p.unit_id
    where p.share_token = p_token and p.status = 'published'
  ) payload;
  return v_result;
end;
$$;

grant execute on function get_published_program(text) to anon, authenticated;

-- Public read for confirm-link.
create or replace function get_assignment_by_confirm_token(p_token uuid)
returns jsonb language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'id', a.id, 'slot', a.slot, 'length_minutes', a.length_minutes,
    'status', a.status, 'last_response', a.last_response,
    'responded_at', a.responded_at, 'confirmation_source', a.confirmation_source,
    'meeting_date', p.meeting_date,
    'speaker_name', coalesce(s.full_name, a.custom_speaker_name),
    'topic_title', coalesce(t.title, a.custom_topic_text),
    'topic_description', t.description,
    'branch_name', u.name,
    'unit_type', u.type
  )
  from speaking_assignments a
  join programs p on p.id = a.program_id
  join units u on u.id = p.unit_id
  left join speakers s on s.id = a.speaker_id
  left join topics t on t.id = a.topic_id
  where a.confirm_token = p_token;
$$;

grant execute on function get_assignment_by_confirm_token(uuid) to anon, authenticated;

-- Public write — speaker self-confirms.
create or replace function respond_to_assignment(p_token uuid, p_response text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_assignment_id uuid;
begin
  if p_response not in ('confirmed','declined') then
    raise exception 'Invalid response.';
  end if;
  select id into v_assignment_id from speaking_assignments where confirm_token = p_token;
  if v_assignment_id is null then
    return jsonb_build_object('ok', false, 'error', 'Link not found.');
  end if;
  update speaking_assignments
    set status = p_response::assignment_status,
        last_response = p_response,
        responded_at = now(),
        confirmation_source = 'self'
    where id = v_assignment_id;
  return jsonb_build_object('ok', true, 'status', p_response);
end;
$$;

grant execute on function respond_to_assignment(uuid, text) to anon, authenticated;

-- Inbound SMS lookup.
create or replace function resolve_pending_assignment_for_phone(p_phone text)
returns jsonb language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'id', a.id,
    'speaker_name', s.full_name,
    'speaker_phone', s.phone,
    'status', a.status,
    'meeting_date', p.meeting_date
  )
  from speaking_assignments a
  join speakers s on s.id = a.speaker_id
  join programs p on p.id = a.program_id
  where s.phone is not null
    and regexp_replace(s.phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
    and a.status = 'awaiting_confirmation'
  order by a.invited_at desc nulls last
  limit 1;
$$;

grant execute on function resolve_pending_assignment_for_phone(text) to anon, authenticated;

-- ============================================================================
-- UNIT BOOTSTRAP — atomic "create new unit + seat creator as first leader"
-- ============================================================================

create or replace function create_unit(
  p_name text,
  p_type unit_type,
  p_full_name text,
  p_position leader_position
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_unit_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to create a unit.';
  end if;
  -- Insert the unit (owner = caller)
  insert into units (name, type, owner_id)
  values (p_name, p_type, auth.uid())
  returning id into v_unit_id;
  -- Ensure profile + name
  insert into profiles (id, full_name, email, active_unit_id)
  values (auth.uid(), p_full_name,
          (select email from auth.users where id = auth.uid()),
          v_unit_id)
  on conflict (id) do update
    set full_name = excluded.full_name,
        active_unit_id = excluded.active_unit_id;
  -- Seat as first leader with chosen position
  insert into unit_members (unit_id, user_id, role, position)
  values (v_unit_id, auth.uid(), 'leader', p_position);
  return v_unit_id;
end;
$$;

grant execute on function create_unit(text, unit_type, text, leader_position) to authenticated;

-- ============================================================================
-- HYMNS SEED (LDS English 1985 hymnal — 1..341)
-- A minimal stub so the picker isn't empty. Run a separate seed for full data.
-- ============================================================================
insert into hymns (number, title) values
  (1, 'The Morning Breaks'),
  (2, 'The Spirit of God'),
  (3, 'Now Let Us Rejoice'),
  (4, 'Truth Eternal'),
  (5, 'High on the Mountain Top'),
  (6, 'Redeemer of Israel'),
  (7, 'Israel, Israel, God Is Calling')
on conflict (number) do nothing;
