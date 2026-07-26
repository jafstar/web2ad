import { createClient } from '../../../../../lib/supabase/server'
import { buildBeatAd } from '../../../../../lib/adbuilder/beatPipeline.js'

// Real isolated test surface for the new phrase-timed beat pipeline -
// same real Flux/Hailuo/ElevenLabs calls as a full run (4-6 shots +
// per-beat narration), so this genuinely costs real money per test, same
// as everything else in the Playground. Not wired into the real funnel.
export const maxDuration = 300

export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })

    const { brief } = await req.json()
    if (!brief?.businessName || !brief?.whatTheyDo) return Response.json({ error: 'Missing brief' }, { status: 400 })

    const runId = `beattest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const result = await buildBeatAd(runId, brief)
    return Response.json(result)
  } catch (e) {
    console.error('adbuilder/playground/beatad failed:', e)
    return Response.json({ error: e.message || 'Could not build the beat ad' }, { status: 500 })
  }
}
