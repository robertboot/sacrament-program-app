-- #7: hymn usage alerts + verse notes.
--
-- hymns gain:
--   usage_tags  text[]  — e.g. {'sacrament','christmas'} for context warnings
--   verse_note  text    — e.g. "Verses 1, 3, 5, 6" for verse-restricted hymns
-- programs gain a per-slot opt-in so the bishop chooses whether the verse
-- note prints on that week's program.

alter table hymns
  add column if not exists usage_tags text[] not null default '{}',
  add column if not exists verse_note text;

-- Seed the well-known fixed sections of the 1985 English hymnbook. The other
-- usages (funeral, baptism, stake conference, Palm Sunday, July 4) are
-- conventions rather than hymnal sections — tag those via Settings.
update hymns set usage_tags = array_append(usage_tags, 'sacrament')
  where hymnal = '1985' and number between 169 and 196
    and not ('sacrament' = any(usage_tags));
update hymns set usage_tags = array_append(usage_tags, 'easter')
  where hymnal = '1985' and number between 197 and 200
    and not ('easter' = any(usage_tags));
update hymns set usage_tags = array_append(usage_tags, 'christmas')
  where hymnal = '1985' and number between 201 and 214
    and not ('christmas' = any(usage_tags));

alter table programs
  add column if not exists opening_hymn_verse_note boolean not null default false,
  add column if not exists sacrament_hymn_verse_note boolean not null default false,
  add column if not exists intermediate_hymn_verse_note boolean not null default false,
  add column if not exists closing_hymn_verse_note boolean not null default false;

-- Re-publish the share payload so the public bulletin shows the verse note
-- inline in the hymn title when the bishop opted in for that slot.
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
      (select to_json(c) from (
        select pr.full_name, pr.bishopric_position from profiles pr where pr.id = p.conducting_id
      ) c) as conducting,
      (select to_json(h) from (
        select number,
          title || case when p.opening_hymn_verse_note and verse_note is not null
            then ' (' || verse_note || ')' else '' end as title
        from hymns where id = p.opening_hymn_id
      ) h) as opening_hymn,
      (select to_json(h) from (
        select number,
          title || case when p.sacrament_hymn_verse_note and verse_note is not null
            then ' (' || verse_note || ')' else '' end as title
        from hymns where id = p.sacrament_hymn_id
      ) h) as sacrament_hymn,
      (select to_json(h) from (
        select number,
          title || case when p.intermediate_hymn_verse_note and verse_note is not null
            then ' (' || verse_note || ')' else '' end as title
        from hymns where id = p.intermediate_hymn_id
      ) h) as intermediate_hymn,
      (select to_json(h) from (
        select number,
          title || case when p.closing_hymn_verse_note and verse_note is not null
            then ' (' || verse_note || ')' else '' end as title
        from hymns where id = p.closing_hymn_id
      ) h) as closing_hymn,
      (
        select json_agg(json_build_object(
          'slot', a.slot, 'length_minutes', a.length_minutes,
          'speaker_name', coalesce(sp.full_name, a.custom_speaker_name),
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
          'title', e.title, 'description', e.description, 'event_date', e.event_date
        ) order by e.event_date nulls last), '[]'::json)
        from events e where p.meeting_date between e.display_start and e.display_end
      ) as events,
      (select to_json(s) from (
        select branch_name, unit_type from app_settings where id = 1
      ) s) as settings
    from programs p
    where p.share_token = p_token and p.status = 'published'
  ) payload;
  return v_result;
end;
$$;
