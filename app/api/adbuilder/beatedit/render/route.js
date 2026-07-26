import fs from 'fs'
import os from 'os'
import path from 'path'
import { createClient } from '../../../../../lib/supabase/server'
import { loadEditableProject, saveProjectData } from '../../../../../lib/adbuilder/beatEditStore.js'
import { synthesizeBeatAudio, composeBeatAd } from '../../../../../lib/adbuilder/beatPipeline.js'

// Re-composites the fork's CURRENT beats (whichever images/clips have
// been individually regenerated, mixed with whichever haven't) using the
// exact same phrase-timed compositor the original ad used - composeBeatAd,
// imported as-is, never reimplemented, so an edited ad keeps the same
// precise pacing/timing model instead of regressing to something cruder.
//
// Narration is re-synthesized fresh every render rather than reused from
// the original run: audioPath is a local temp file from a PAST serverless
// invocation and doesn't survive to this one, and re-synthesizing also
// naturally keeps each beat's targetDuration in sync with its real
// current narration length. renderUrl (fixed ~6s tier, same as
// beatPipeline's RENDER_DURATION_SECONDS) is what composeBeatAd trims
// down to that fresh targetDuration, whether it's the original clip or
// one regenerated via beatedit/motion.
export const maxDuration = 300

export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })

    const { runId } = await req.json()
    if (!runId) return Response.json({ error: 'Missing runId' }, { status: 400 })

    const project = await loadEditableProject(supabase, user, runId)
    const beats = project.data.beats
    const missing = beats.find((b) => !b.renderUrl)
    if (missing) return Response.json({ error: `Beat ${missing.id} still needs a video clip — regenerate its image and motion first.` }, { status: 400 })

    const apiKey = process.env.ELEVEN_LABS_API_KEY
    if (!apiKey) return Response.json({ error: 'ELEVEN_LABS_API_KEY not configured' }, { status: 500 })

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adbuilder-beatedit-render-'))
    let result
    try {
      await synthesizeBeatAudio(beats, tmp, apiKey)
      result = await composeBeatAd(runId, project.data.brief, beats)
    } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}
    }

    // Drop the ephemeral local audioPath before persisting - meaningless
    // outside this one request, and the next render regenerates it fresh.
    const cleanBeats = beats.map(({ audioPath, ...rest }) => rest)
    await saveProjectData(supabase, project.id, {
      ...project.data,
      beats: cleanBeats,
      videoUrl: result.url,
      durationSeconds: result.durationSeconds,
      sceneImageUrl: cleanBeats[0]?.keyframeUrl || project.data.sceneImageUrl,
    })

    return Response.json({ url: result.url, durationSeconds: result.durationSeconds })
  } catch (e) {
    console.error('adbuilder/beatedit/render failed:', e)
    return Response.json({ error: e.message || 'Could not re-render this ad' }, { status: 500 })
  }
}
