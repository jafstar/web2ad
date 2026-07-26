// Real production bug this replaces: shots.js/exportAd.js/musicEditor.js
// used to keep each run's whole state as a local schema.json under
// process.cwd()/.adbuilder-runs/<runId>/ - fine in `next dev` (one
// long-lived process, real disk) but broken on Vercel two separate ways:
// process.cwd() resolves to the deployed bundle's READ-ONLY directory
// (immediate crash), and even /tmp wouldn't fix it since the paid flow
// spans multiple separate requests over real time that can each land on a
// different serverless container. adbuilder_runs (see
// supabase/migrations/0007_adbuilder_runs.sql) is the real persistent
// replacement. Every call goes through the service-role admin client -
// same reasoning as credit_balances/purchases: background/patch calls
// don't always carry the user's own session context, and run_id itself is
// only ever handed to the owning user through the app's own UI.
import { createAdminClient } from '../supabase/admin.js'

export async function readSchema(runId) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('adbuilder_runs')
    .select('schema')
    .eq('run_id', runId)
    .single()
  if (error || !data) throw new Error(`Run not found: ${runId}`)
  return data.schema
}

export async function createRun(runId, schema, userId = null) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('adbuilder_runs')
    .insert({ run_id: runId, schema, user_id: userId })
  if (error) throw new Error(`Failed to create run: ${error.message}`)
}

// Full-schema overwrite - fine for actions that aren't called concurrently
// for the same run (toggleShot, export, music selection). Shot-status
// updates during parallel generation use patchShot below instead, which
// is race-safe.
export async function writeSchema(runId, schema) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('adbuilder_runs')
    .update({ schema, updated_at: new Date().toISOString() })
    .eq('run_id', runId)
  if (error) throw new Error(`Failed to save run: ${error.message}`)
}

// Atomic per-shot merge via the adbuilder_patch_shot RPC (see
// 0008_adbuilder_atomic_shot_patch.sql) - safe to call concurrently for
// different shots of the same run, unlike a readSchema+writeSchema
// round-trip. Pass `null` for a field to clear it (e.g. { error: null }
// on a successful retry after an earlier failure).
export async function patchShot(runId, shotId, patch) {
  const supabase = createAdminClient()
  const { error } = await supabase.rpc('adbuilder_patch_shot', {
    p_run_id: runId,
    p_shot_id: shotId,
    p_patch: patch,
  })
  if (error) throw new Error(`Failed to patch shot ${shotId}: ${error.message}`)
}
