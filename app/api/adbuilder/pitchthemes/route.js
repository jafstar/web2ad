import { pitchThemes } from '../../../../lib/adbuilder/beatPipeline.js'

// Step 2a, part 1: Gemini pitches 3-4 distinct story angles - cheap,
// fast, text-only, no images/audio yet. Free tier, no auth, same as
// ingest/storyboardpreview.
export const maxDuration = 30

export async function POST(req) {
  try {
    const { brief, direction } = await req.json()
    if (!brief?.businessName || !brief?.whatTheyDo) return Response.json({ error: 'Missing brief' }, { status: 400 })
    const themes = await pitchThemes(brief, direction)
    return Response.json({ themes })
  } catch (e) {
    console.error('adbuilder/pitchthemes failed:', e)
    return Response.json({ error: e.message || 'Could not pitch story ideas' }, { status: 500 })
  }
}
