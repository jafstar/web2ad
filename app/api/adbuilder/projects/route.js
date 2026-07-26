import { createClient } from '../../../../lib/supabase/server'
import { createAdminClient } from '../../../../lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Sign in to see your ads' }, { status: 401 })

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, data, created_at')
    .eq('project_type', 'ad')
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Real derived status per ad, read straight from the run's own schema
  // (adbuilder_runs, see runStore.js) rather than duplicating it into the
  // project row - that table is already the single source of truth for
  // shot/export state, so this avoids a second copy that could drift out
  // of sync with it. One batched IN query instead of N round-trips.
  //
  // Real bug this fixes, live-caught: adbuilder_runs has RLS enabled with
  // NO policies (deliberate - every read/write was meant to go through
  // the service-role admin client only, see runStore.js/0007's migration
  // comment). Querying it here with the regular session-scoped `supabase`
  // client silently returned zero rows every time (RLS-with-no-policy
  // filters to nothing, it doesn't error) - every ad showed "Incomplete"
  // regardless of real status, even ones with a genuine finished export.
  const admin = createAdminClient()
  const runIds = data.map((p) => p.data?.runId).filter(Boolean)
  const schemasByRunId = {}
  if (runIds.length) {
    const { data: runs } = await admin
      .from('adbuilder_runs')
      .select('run_id, schema')
      .in('run_id', runIds)
    for (const r of runs || []) schemasByRunId[r.run_id] = r.schema
  }

  const projects = data.map((p) => {
    const runId = p.data?.runId
    const schema = runId ? schemasByRunId[runId] : null
    if (!schema) return { ...p, status: runId ? 'editing' : 'pending', thumbnailShotId: null }
    const thumbnailShotId = schema.shots?.find((s) => !s.disabled && s.status === 'done')?.id ?? null
    return { ...p, status: schema.export ? 'done' : 'editing', thumbnailShotId }
  })

  return Response.json({ projects })
}
