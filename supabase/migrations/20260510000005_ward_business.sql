-- Ward Business — six independent toggles + name fields. The bishop checks the
-- categories that apply for the week, and the printed program skips any that
-- are unchecked. If none are checked, the program prints "There is no Ward
-- Business this week."
--
-- "Releases" and "Sustainings" already had text fields; we add their toggle
-- and backfill it based on whether text is present.

alter table programs add column if not exists ward_business_releases boolean not null default false;
alter table programs add column if not exists ward_business_sustainings boolean not null default false;
alter table programs add column if not exists ward_business_move_in_welcomes boolean not null default false;
alter table programs add column if not exists ward_business_aaronic_sustainings boolean not null default false;
alter table programs add column if not exists ward_business_baptism_confirmation boolean not null default false;
alter table programs add column if not exists ward_business_baby_blessing boolean not null default false;

alter table programs add column if not exists move_in_welcomes text;
alter table programs add column if not exists aaronic_sustainings text;
alter table programs add column if not exists baptism_confirmation text;
alter table programs add column if not exists baby_blessing text;

update programs set ward_business_releases = true
  where releases is not null and length(trim(releases)) > 0;
update programs set ward_business_sustainings = true
  where sustainings is not null and length(trim(sustainings)) > 0;

-- Public share function: include ward business fields so the same conditional
-- render shows on /p/<token> pages too.
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
      p.move_in_welcomes,
      p.aaronic_sustainings,
      p.baptism_confirmation,
      p.baby_blessing,
      p.stake_business,
      p.ward_business_releases,
      p.ward_business_sustainings,
      p.ward_business_move_in_welcomes,
      p.ward_business_aaronic_sustainings,
      p.ward_business_baptism_confirmation,
      p.ward_business_baby_blessing,
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
