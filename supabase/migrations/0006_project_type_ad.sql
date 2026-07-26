-- Ad-builder runs now get recorded as real projects (see /api/adbuilder/run)
-- instead of living only as an unlinked file under .adbuilder-runs/ — same
-- real gap 0005 closed for 'story'.
alter table projects drop constraint projects_project_type_check;
alter table projects add constraint projects_project_type_check
  check (project_type in ('photos', 'story', 'ad'));
