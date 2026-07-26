import { previewFirstBeat } from '../../../../lib/adbuilder/beatPipeline.js'

// Step 2 of the new 3-step v2 funnel (url -> preview -> generate+download):
// writes the real beat sequence and renders just the FIRST beat's
// narration + scene image - same free/cheap cost tradeoff v1's own
// preview route makes, not a full composite. No auth required, matches
// v1's free-preview tier.
export const maxDuration = 90

export async function POST(req) {
  try {
    const { brief } = await req.json()
    if (!brief?.businessName || !brief?.whatTheyDo) return Response.json({ error: 'Missing brief' }, { status: 400 })
    const result = await previewFirstBeat(brief)
    return Response.json(result)
  } catch (e) {
    console.error('adbuilder/beatpreview failed:', e)
    return Response.json({ error: e.message || 'Could not build your preview' }, { status: 500 })
  }
}
