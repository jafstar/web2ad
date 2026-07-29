import { createClient } from '../../../../../lib/supabase/server'
import { createAdminClient } from '../../../../../lib/supabase/admin'

// First step of the (now 3-step) generation flow, split live 2026-07-29
// to fix a real production timeout: generating every beat inside one
// giant request could exceed Vercel's function duration ceiling once
// tonight's writing-quality improvements made ads longer/richer -
// bumping maxDuration past 300s even failed to deploy outright (no
// Fluid Compute config for this project). Splitting into
// start -> beat (xN) -> combine means no single request has to span the
// whole generation, ever, regardless of ad length - same principle v1's
// per-shot ShotReview polling already uses, just without needing a
// background-job schema for it.
//
// This step ONLY claims the stash (same atomic delete-and-check
// idempotency guard the old single-request beatrun used, see git
// history) - no generation happens here, so it's fast and safe
// regardless of ad size.
export const maxDuration = 30

export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Sign in to generate your full ad' }, { status: 401 })

    const { stashId } = await req.json()
    if (!stashId) return Response.json({ error: 'Missing stashId' }, { status: 400 })

    const admin = createAdminClient()
    const { data: claimed } = await admin.from('adbuilder_stash').delete().eq('id', stashId).select('id, brief, script')
    if (!claimed?.length) return Response.json({ error: 'This ad has already been generated, or your link has expired.' }, { status: 409 })

    const { brief, script } = claimed[0]
    const runId = `beat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    return Response.json({ runId, brief, beats: script.beats, atmosphere: script.atmosphere })
  } catch (e) {
    console.error('adbuilder/beatrun/start failed:', e)
    return Response.json({ error: e.message || 'Could not start generation' }, { status: 500 })
  }
}
