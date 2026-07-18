-- Story project type (character-lock + scene-sequence generation) shipped
-- 2026-07-18, but the original 0004 check constraint only allowed
-- 'photos' — real bug, caught live via the "new row ... violates check
-- constraint" error when actually creating a Story project in prod.
alter table projects drop constraint projects_project_type_check;
alter table projects add constraint projects_project_type_check
  check (project_type in ('photos', 'story'));
