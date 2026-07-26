import { createClient } from '../../../../../lib/supabase/server'

// "Fork to Edit" - the real paywall point, per 2026-07-26's discussion:
// the free 3-step flow's output is read-only forever; forking is the one
// deliberate action that produces an editable copy. Currently ungated
// (every signed-in user can fork) since real adbuilder pricing doesn't
// exist yet (Pricing page still says "Coming soon") - the gate check
// belongs right here, as a single early return, once it does.
//
// A fork is a cheap DB copy, not a regeneration - no real API cost, so
// there's no reason to restrict it further than "you own the original."
// RLS's "select/insert own projects" policies (0004_projects.sql) do the
// real ownership enforcement; the session-scoped client here can only
// ever see/create rows for auth.uid() = user_id.
export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Sign in to fork this ad' }, { status: 401 })

    const { runId } = await req.json()
    if (!runId) return Response.json({ error: 'Missing runId' }, { status: 400 })

    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, name, data')
      .eq('project_type', 'ad')
      .eq('user_id', user.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const source = projects?.find((p) => p.data?.v2 && p.data?.runId === runId)
    if (!source) return Response.json({ error: 'Could not find that ad' }, { status: 404 })
    if (!source.data.beats?.length) return Response.json({ error: 'This ad has no editable beat data' }, { status: 400 })

    const forkRunId = `beatfork-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const { error: insertError } = await supabase.from('projects').insert({
      user_id: user.id,
      name: `${source.name} (fork)`,
      project_type: 'ad',
      data: { ...source.data, runId: forkRunId, editable: true, forkedFrom: runId },
    })
    if (insertError) return Response.json({ error: insertError.message }, { status: 500 })

    return Response.json({ runId: forkRunId })
  } catch (e) {
    console.error('adbuilder/beatedit/fork failed:', e)
    return Response.json({ error: e.message || 'Could not fork this ad' }, { status: 500 })
  }
}
