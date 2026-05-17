-- #6: explicit per-slot "confirmed" step.
--
-- Auto-generate now fills speaker/topic as a *draft suggestion*; the bishop
-- reviews and clicks "Confirm slot" before the invite workflow opens. That
-- needs a persisted flag distinct from the invite `status`.

alter table speaking_assignments
  add column if not exists slot_confirmed boolean not null default false;

-- Programs created before this change already have assignments mid-workflow.
-- Treat anything with a speaker, a stake name, or a status past not_yet_asked
-- as already confirmed so their invite buttons keep working on deploy.
update speaking_assignments
  set slot_confirmed = true
  where speaker_id is not null
     or custom_speaker_name is not null
     or status <> 'not_yet_asked';
