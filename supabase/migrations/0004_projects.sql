-- Mirrors designpipe-app's real projects schema (main/db.js) exactly —
-- deliberate, not a redesign: Mayor's call is "develop in DesignPipe,
-- dump it into GenStock," so the DATA shape needs to match too, not just
-- the UI, for the ipc-shim transfer pattern to actually be 1:1.
--
-- Real difference from designpipe-app's version: `data.gallery` items
-- store a Cloudinary `url`, not a base64 dataUrl or a local imagePath —
-- same "images live outside the row" principle as designpipe-app's own
-- post-corruption fix (image-library files), just backed by Cloudinary
-- instead of local disk since this runs server-side/multi-device. A
-- gallery array of small JSON objects (id/round/engine/prompt/url/
-- favorited) is tiny regardless of how many rounds accumulate — the
-- MVCC-bloat mechanism from that incident specifically required
-- multi-MB embedded image bytes, which never happens here.
create table if not exists projects (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  project_type text not null default 'photos' check (project_type in ('photos')),
  data         jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists projects_user_id_idx on projects(user_id);

alter table projects enable row level security;

-- Full CRUD as the owning user, unlike credit_balances/purchases —
-- projects are genuinely user-owned/user-mutated data (rename, gallery
-- updates, favoriting), not something only server routes should touch.
-- The generate route still uses the admin client for the credit-debit
-- transaction, but writes the resulting gallery entries back through
-- the user's own session, same as designpipe-app's saveData.
create policy "select own projects" on projects for select using (auth.uid() = user_id);
create policy "insert own projects" on projects for insert with check (auth.uid() = user_id);
create policy "update own projects" on projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own projects" on projects for delete using (auth.uid() = user_id);
