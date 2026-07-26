import { createClient } from '../../../../../lib/supabase/server'
import { loadEditableProject, saveProjectData } from '../../../../../lib/adbuilder/beatEditStore.js'
import { generateKeyframeFor } from '../../../../../lib/adbuilder/shots.js'

// Regenerates ONE beat's image on a forked (editable) ad - same real Flux
// call the original generation used (generateKeyframeFor, imported from
// shots.js, not reimplemented), just scoped to a single beat instead of
// the whole ad. Clears that beat's renderUrl since its motion clip was
// generated from the OLD image and is now stale - the edit UI should
// prompt for a motion regenerate next, not silently keep a mismatched clip.
export const maxDuration = 60

export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })

    const { runId, beatId, fixNote } = await req.json()
    if (!runId || !beatId) return Response.json({ error: 'Missing runId or beatId' }, { status: 400 })

    const project = await loadEditableProject(supabase, user, runId)
    const beats = project.data.beats
    const beat = beats.find((b) => b.id === beatId)
    if (!beat) return Response.json({ error: 'Beat not found' }, { status: 404 })

    const { url } = await generateKeyframeFor(runId, beatId, beat.visual, project.data.brief, project.data.atmosphere, fixNote || '')
    beat.keyframeUrl = url
    beat.renderUrl = null

    await saveProjectData(supabase, project.id, { ...project.data, beats })
    return Response.json({ beat })
  } catch (e) {
    console.error('adbuilder/beatedit/keyframe failed:', e)
    return Response.json({ error: e.message || 'Could not regenerate that image' }, { status: 500 })
  }
}
