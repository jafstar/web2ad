import { pitchThemes } from '../../../../lib/adbuilder/beatPipeline.js'

// Step 2a, part 1: Gemini pitches 3-4 distinct story angles - cheap,
// fast, text-only, no images/audio yet. Free tier, no auth, same as
// ingest/storyboardpreview.
//
// regenCount: real, if soft, quota - "See More Ideas" is limited to one
// extra pitch for public/free users. Client tracks and disables the
// button after one use; this check is the honesty-based server backstop
// (same trust level as the rest of this free tier, which has no auth to
// enforce anything harder against a determined direct API call).
export const maxDuration = 30

export async function POST(req) {
  try {
    const { brief, direction, tone, excludeTitles, regenCount } = await req.json()
    if (!brief?.businessName || !brief?.whatTheyDo) return Response.json({ error: 'Missing brief' }, { status: 400 })
    if ((regenCount || 0) > 1) return Response.json({ error: 'Free preview limit reached for new story angles on this ad' }, { status: 429 })
    const themes = await pitchThemes(brief, direction, tone, excludeTitles)
    return Response.json({ themes })
  } catch (e) {
    console.error('adbuilder/pitchthemes failed:', e)
    return Response.json({ error: e.message || 'Could not pitch story ideas' }, { status: 500 })
  }
}
