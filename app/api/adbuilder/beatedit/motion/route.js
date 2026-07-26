import { createClient } from '../../../../../lib/supabase/server'
import { loadEditableProject, saveProjectData } from '../../../../../lib/adbuilder/beatEditStore.js'
import { generateMotionFor, urlToDataUrl } from '../../../../../lib/adbuilder/shots.js'

// Regenerates ONE beat's motion clip from its CURRENT keyframe - the same
// real Hailuo call the original generation used. Always renders at the
// fixed engine tier (matches beatPipeline.js's RENDER_DURATION_SECONDS);
// re-rendering the full ad (see render/route.js) is what trims it down to
// this beat's real target duration.
export const maxDuration = 300
const RENDER_DURATION_SECONDS = 6

export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })

    const { runId, beatId } = await req.json()
    if (!runId || !beatId) return Response.json({ error: 'Missing runId or beatId' }, { status: 400 })

    const project = await loadEditableProject(supabase, user, runId)
    const beats = project.data.beats
    const beat = beats.find((b) => b.id === beatId)
    if (!beat) return Response.json({ error: 'Beat not found' }, { status: 404 })
    if (!beat.keyframeUrl) return Response.json({ error: 'Regenerate this beat\'s image first' }, { status: 400 })

    const imageDataUrl = await urlToDataUrl(beat.keyframeUrl)
    beat.renderUrl = await generateMotionFor(runId, beatId, imageDataUrl, beat.visual, RENDER_DURATION_SECONDS)

    await saveProjectData(supabase, project.id, { ...project.data, beats })
    return Response.json({ beat })
  } catch (e) {
    console.error('adbuilder/beatedit/motion failed:', e)
    return Response.json({ error: e.message || 'Could not regenerate that clip' }, { status: 500 })
  }
}
