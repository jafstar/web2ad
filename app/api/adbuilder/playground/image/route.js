import { createClient } from '../../../../../lib/supabase/server'
import { generateFlux } from '../../../../../lib/engines/flux.js'
import { NO_TEXT_SUFFIX } from '../../../../../lib/promptGuards.js'

export const maxDuration = 60

// Real debug tool - test a raw visual/scene description against Flux
// directly, without running an actual ad through ingest/script/shots.
// Gated behind auth since it costs real API spend per call, same as
// every other generation route.
export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })

    const { prompt } = await req.json()
    if (!prompt?.trim()) return Response.json({ error: 'Missing prompt' }, { status: 400 })

    const imageDataUrl = await generateFlux(`${prompt}${NO_TEXT_SUFFIX}`, 1024, 1024)
    return Response.json({ imageDataUrl })
  } catch (e) {
    console.error('adbuilder/playground/image failed:', e)
    return Response.json({ error: e.message || 'Could not generate image' }, { status: 500 })
  }
}
