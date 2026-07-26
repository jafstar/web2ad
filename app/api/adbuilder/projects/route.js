import fs from 'fs'
import path from 'path'
import { createClient } from '../../../../lib/supabase/server'

const RUNS_DIR = path.join(process.cwd(), '.adbuilder-runs')

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

  // Real derived status per ad, read straight from the run's schema on
  // disk rather than duplicating it into the Supabase row - that file is
  // already the single source of truth for shot/export state, so this
  // avoids a second copy that could drift out of sync with it.
  const projects = data.map((p) => {
    const runId = p.data?.runId
    if (!runId) return { ...p, status: 'pending' }
    try {
      const schema = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, runId, 'schema.json'), 'utf8'))
      const thumbnailShotId = schema.shots.find((s) => !s.disabled && s.status === 'done')?.id ?? null
      return { ...p, status: schema.export ? 'done' : 'editing', thumbnailShotId }
    } catch {
      return { ...p, status: 'editing', thumbnailShotId: null }
    }
  })

  return Response.json({ projects })
}
