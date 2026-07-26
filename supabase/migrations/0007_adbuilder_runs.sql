-- Real production bug this fixes: the whole paid-tier ad pipeline (shots,
-- exports, music editing) was built on local disk under
-- process.cwd()/.adbuilder-runs/<runId>/ - works in `next dev` (one
-- long-lived process, real writable disk) but breaks two different ways on
-- Vercel: process.cwd() resolves to the deployed bundle's READ-ONLY
-- directory (immediate write failure), and even /tmp wouldn't help since
-- the paid flow spans multiple separate requests over real time (shot
-- generation, per-shot patch/regen, export) that can each land on a
-- different, fresh serverless container with no shared disk between them.
--
-- adbuilder_runs replaces the on-disk schema.json - the single JSON blob
-- readSchema/writeSchema in shots.js already treated as the run's whole
-- state, moved as-is into a jsonb column. adbuilder_stash replaces the
-- local .adbuilder-runs/_stash/ files bridging the magic-link redirect
-- (same cross-invocation problem, just over a shorter real-world gap).
-- Actual binary media (keyframes/renders/audio/final export) move to
-- Cloudinary, same "images live outside the row" principle 0004_projects.sql
-- already established for gallery items - schema.shots[].keyframeUrl /
-- renderUrl now hold Cloudinary URLs instead of local file paths.

create table if not exists adbuilder_runs (
  run_id     text primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  schema     jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists adbuilder_runs_user_id_idx on adbuilder_runs(user_id);

alter table adbuilder_runs enable row level security;

-- Every adbuilder_runs read/write goes through the service-role admin
-- client (lib/supabase/admin.js) - the same reasoning as
-- credit_balances/purchases in 0001_credits_schema.sql: run generation
-- happens across background/patch calls that don't always carry the
-- user's own session context, and run_id itself is only ever handed to
-- the owning user through the app's own UI (never guessable/listed), so
-- there's no separate user-facing policy needed here.

create table if not exists adbuilder_stash (
  id                text primary key,
  brief             jsonb not null,
  script            jsonb not null,
  preview_image_url text,
  created_at        timestamptz not null default now()
);

-- Short-lived by design (bridges a single magic-link redirect) - the
-- stash id itself is the access control, same as the local-file version
-- it replaces. Service-role only, same reasoning as adbuilder_runs.
alter table adbuilder_stash enable row level security;
