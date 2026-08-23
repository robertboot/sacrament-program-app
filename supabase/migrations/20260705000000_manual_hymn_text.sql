-- Manual "Enter manually" support for the three hymn slots that
-- previously only accepted a hymn-catalog pick. Mirrors the
-- intermediate_hymn_text pattern that's been in place since day one.
-- Either the *_hymn_id or the *_hymn_text is set (never both);
-- renderers prefer text if present, else look up the hymn by id.
--
-- Intentionally additive-only. The get_published_program RPC isn't
-- touched here — the app fetches the new text columns via a small
-- side query in render-published.tsx so we don't have to rewrite an
-- RPC whose exact shape has drifted across migrations.

alter table programs
  add column if not exists opening_hymn_text text,
  add column if not exists sacrament_hymn_text text,
  add column if not exists closing_hymn_text text;
