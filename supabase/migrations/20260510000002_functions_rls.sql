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
