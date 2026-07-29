import { createClient } from '../../../../../lib/supabase/server'
import { generateKeyframeFor, generateMotionFor } from '../../../../../lib/adbuilder/shots.js'
import { RENDER_DURATION_SECONDS, MOTION_PACING_NOTE } from '../../../../../lib/adbuilder/beatPipeline.js'

// Generates ONE beat's real keyframe + motion clip - scoped to a single
// beat so this can never approach any request-duration ceiling
// regardless of how many beats the ad has. Called by the client once per
// beat, staggered (see beatfinish/page.js), instead of the server
// looping through all of them inside one request.
export const maxDuration = 300

export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })

    const { runId, beat, brief, atmosphere, referenceImageDataUrl } = await req.json()
    if (!runId || !beat?.id || !beat?.visual) return Response.json({ error: 'Missing runId or beat' }, { status: 400 })

    const { url: keyframeUrl, dataUrl } = await generateKeyframeFor(runId, beat.id, beat.visual, brief, atmosphere, '', referenceImageDataUrl || null)
    const renderUrl = await generateMotionFor(runId, beat.id, dataUrl, `${beat.visual}${MOTION_PACING_NOTE}`, RENDER_DURATION_SECONDS)

    return Response.json({ id: beat.id, keyframeUrl, renderUrl })
  } catch (e) {
    console.error('adbuilder/beatrun/beat failed:', e)
    return Response.json({ error: e.message || 'Could not generate that scene' }, { status: 500 })
  }
}
