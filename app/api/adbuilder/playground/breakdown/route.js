import { createClient } from '../../../../../lib/supabase/server'
import { generateShotBreakdown } from '../../../../../lib/adbuilder/shots.js'

// Real debug tool - test the shot breakdown (max scenes / framing bias /
// clip-duration wording) in isolation, text-only, before spending real
// image/video generation money confirming it through a full run.
export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })

    const { brief, script, options } = await req.json()
    if (!brief || !script) return Response.json({ error: 'Missing brief or script' }, { status: 400 })

    const result = await generateShotBreakdown(brief, script, options)
    return Response.json(result)
  } catch (e) {
    console.error('adbuilder/playground/breakdown failed:', e)
    return Response.json({ error: e.message || 'Could not generate breakdown' }, { status: 500 })
  }
}
