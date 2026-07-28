import { buildStoryboardPreview } from '../../../../lib/adbuilder/beatPipeline.js'

// The "fake video player" preview - real images, real narration, real
// music for every beat, no Hailuo motion generation (the expensive
// part). Free tier, no auth required, same as the rest of step 1/2.
// This is now step 2b - beats (from step 2a's theme pick + edit) are
// normally passed in already-written, so this doesn't write a second,
// different draft; direction-only calls (no beats) still work as a
// fallback and write fresh.
export const maxDuration = 120

export async function POST(req) {
  try {
    const { brief, direction, beats, atmosphere, referenceImageDataUrl } = await req.json()
    if (!brief?.businessName || !brief?.whatTheyDo) return Response.json({ error: 'Missing brief' }, { status: 400 })
    const precomputed = beats?.length ? { beats, atmosphere } : null
    const result = await buildStoryboardPreview(brief, direction, { precomputed, referenceImageDataUrl })
    return Response.json(result)
  } catch (e) {
    console.error('adbuilder/storyboardpreview failed:', e)
    return Response.json({ error: e.message || 'Could not build your preview' }, { status: 500 })
  }
}
