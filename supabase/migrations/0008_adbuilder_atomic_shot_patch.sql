-- Real correctness gap the local-disk version already had, just rarely
-- surfaced: runShotGeneration in shots.js generates shots in PARALLEL
-- (Promise.all), and each one's status update was a plain read-modify-
-- write (readSchema -> mutate one shot -> writeSchema). Two shots
-- finishing close together could both read the same schema, each mutate
-- their own shot, and whichever writes last silently discards the other's
-- update. Local disk I/O was fast enough that the race window rarely hit;
-- a real network round-trip to Postgres makes it far more likely to
-- actually lose an update. This RPC does the shot-level merge atomically
-- inside a single UPDATE instead of a separate read + write from app code.
create or replace function adbuilder_patch_shot(p_run_id text, p_shot_id int, p_patch jsonb)
returns void
language sql
as $$
  update adbuilder_runs
  set schema = jsonb_set(
    schema,
    '{shots}',
    (
      select coalesce(jsonb_agg(
        case when (shot->>'id')::int = p_shot_id
          -- jsonb_strip_nulls lets a patch clear a key by setting it to
          -- null (e.g. {"error": null} on a successful retry) instead of
          -- leaving a stale error from an earlier failed attempt.
          then jsonb_strip_nulls(shot || p_patch)
          else shot
        end
      ), '[]'::jsonb)
      from jsonb_array_elements(schema->'shots') as shot
    )
  ),
  updated_at = now()
  where run_id = p_run_id;
$$;
