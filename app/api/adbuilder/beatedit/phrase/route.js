import { createClient } from '../../../../../lib/supabase/server'
import { loadEditableProject, saveProjectData } from '../../../../../lib/adbuilder/beatEditStore.js'

// Edits ONE beat's narration text on a forked (editable) ad - a plain DB
// write, no generation call. Narration audio is always re-synthesized
// fresh from the CURRENT phrase text at render time (see
// beatedit/render/route.js and synthesizeBeatAudio), which also
// naturally recomputes that beat's targetDuration from the new phrase's
// real spoken length - so editing text here just needs persisting, the
// render step already picks it up correctly.
export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })

    const { runId, beatId, phrase } = await req.json()
    if (!runId || !beatId || !phrase?.trim()) return Response.json({ error: 'Missing runId, beatId, or phrase' }, { status: 400 })

    const project = await loadEditableProject(supabase, user, runId)
    const beats = project.data.beats
    const beat = beats.find((b) => b.id === beatId)
    if (!beat) return Response.json({ error: 'Beat not found' }, { status: 404 })

    beat.phrase = phrase.trim()

    await saveProjectData(supabase, project.id, { ...project.data, beats })
    return Response.json({ beat })
  } catch (e) {
    console.error('adbuilder/beatedit/phrase failed:', e)
    return Response.json({ error: e.message || 'Could not save that narration' }, { status: 500 })
  }
}
