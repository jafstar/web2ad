import fs from 'fs'
import os from 'os'
import path from 'path'
import { createClient } from '../../../../../lib/supabase/server'
import { synthesizeBeatAudio, composeBeatAd, NARRATION_VOICES } from '../../../../../lib/adbuilder/beatPipeline.js'

// Final step: every beat already has a real keyframeUrl+renderUrl from
// its own /beatrun/beat call - this only synthesizes narration (fast)
// and composites (ffmpeg trim/concat/mix + outro + upload), the same
// composeBeatAd the old single-request beatrun used, just never bundled
// together with the slow per-beat generation anymore.
export const maxDuration = 300

export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })

    const { runId, brief, beats, atmosphere } = await req.json()
    if (!runId || !beats?.length) return Response.json({ error: 'Missing runId or beats' }, { status: 400 })
    const missing = beats.find((b) => !b.renderUrl)
    if (missing) return Response.json({ error: `Beat ${missing.id} isn't generated yet` }, { status: 400 })

    const apiKey = process.env.ELEVEN_LABS_API_KEY
    if (!apiKey) return Response.json({ error: 'ELEVEN_LABS_API_KEY not configured' }, { status: 500 })

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adbuilder-beatrun-combine-'))
    let result
    try {
      await synthesizeBeatAudio(beats, tmp, apiKey, NARRATION_VOICES[brief.voiceGender] || NARRATION_VOICES.male)
      result = await composeBeatAd(runId, brief, beats)
    } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}
    }
    // composeBeatAd mutates `beats` in place (targetDuration/
    // narrationStart from synthesizeBeatAudio/its own cumulative timing)
    // but only returns {url, durationSeconds, beatCount} - build the full
    // beats shape buildBeatAd used to return, from the now-complete
    // beats array itself.
    result.beats = beats.map((b) => ({ id: b.id, phrase: b.phrase, visual: b.visual, targetDuration: b.targetDuration, narrationStart: b.narrationStart, keyframeUrl: b.keyframeUrl, renderUrl: b.renderUrl }))
    result.atmosphere = atmosphere

    // Record it to "My Ads" only once the real video exists - same
    // best-effort insert the old single-request beatrun used.
    const name = brief.businessName || 'Untitled ad'
    try {
      const { count } = await supabase.from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('project_type', 'ad')
        .eq('name', name)

      const { error: insertError } = await supabase.from('projects').insert({
        user_id: user.id,
        name,
        project_type: 'ad',
        data: {
          v2: true,
          runId,
          businessName: brief.businessName,
          whatTheyDo: brief.whatTheyDo,
          brief,
          atmosphere: result.atmosphere,
          beats: result.beats,
          videoUrl: result.url,
          sceneImageUrl: result.beats?.[0]?.keyframeUrl || null,
          durationSeconds: result.durationSeconds,
          beatCount: result.beatCount,
          take: (count || 0) + 1,
        },
      })
      if (insertError) console.error('adbuilder/beatrun/combine: failed to record project row:', insertError.message)
    } catch (e) {
      console.error('adbuilder/beatrun/combine: failed to record project row:', e.message)
    }

    return Response.json({ runId, ...result })
  } catch (e) {
    console.error('adbuilder/beatrun/combine failed:', e)
    return Response.json({ error: e.message || 'Could not finish your ad' }, { status: 500 })
  }
}
