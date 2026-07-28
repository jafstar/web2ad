import { buildStoryboardPreview } from '../../../../lib/adbuilder/beatPipeline.js'

// The "fake video player" preview - real images, real narration, real
// music for every beat, no Hailuo motion generation (the expensive
// part). Free tier, no auth required, same as the rest of step 1/2 -
// this replaces the old single-beat-only preview (previewFirstBeat) as
// step 2's real content.
export const maxDuration = 120

export async function POST(req) {
  try {
    const { brief, direction } = await req.json()
    if (!brief?.businessName || !brief?.whatTheyDo) return Response.json({ error: 'Missing brief' }, { status: 400 })
    const result = await buildStoryboardPreview(brief, direction)
    return Response.json(result)
  } catch (e) {
    console.error('adbuilder/storyboardpreview failed:', e)
    return Response.json({ error: e.message || 'Could not build your preview' }, { status: 500 })
  }
}
