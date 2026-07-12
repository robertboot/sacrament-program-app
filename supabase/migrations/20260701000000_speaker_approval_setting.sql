-- Optional workflow: the Bishop / Branch President must approve the
-- auto-generated speaker + topic pick before the invite workflow opens.
--
-- Prior to this setting the approval step was always required. Making it a
-- per-unit toggle so units that don't want the extra click can skip it. Off
-- by default; the UI hides the approval button and treats every slot as
-- pre-approved when this is off.
alter table app_settings
  add column if not exists require_speaker_approval boolean not null default false;
