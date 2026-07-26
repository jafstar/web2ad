import { writeAdStory } from '../../../../lib/adbuilder/story.js'
import { generateShotBreakdown } from '../../../../lib/adbuilder/shots.js'

export async function POST(req) {
  try {
    const { brief, styleTag } = await req.json()
    if (!brief) return Response.json({ error: 'Missing brief' }, { status: 400 })
    // Real Council pass (draft -> refine -> 4-voice critique incl. Grok's
    // Jester -> lead-edit), replacing the old flat single-Claude-call
    // writeScript - validated 2026-07-25 to fix both generic copy AND the
    // shot-breakdown's coherence problem (one real character/throughline
    // instead of independently-invented unrelated shots).
    const script = await writeAdStory(brief, styleTag)
    // Real breakdown of the full ad into scenes, shown to every free
    // visitor so the "paid" tier's shape is visible up front - only
    // scene 1 gets rendered into the free preview, the rest stay text-only
    // until signup.
    //
    // Real regression, live-caught: generateShotBreakdown's return shape
    // changed to {shots, atmosphere} for Atmosphere Fixation, but this
    // caller (unlike shots.js's own initializeRun) never got updated to
    // match - `scenes` silently became the whole object instead of the
    // array, so `scenes?.length > 0` on the frontend was always false and
    // the entire breakdown section stopped rendering with no error.
    const { shots: scenes, atmosphere } = await generateShotBreakdown(brief, script)
    return Response.json({ script, scenes, atmosphere })
  } catch (e) {
    console.error('adbuilder/script failed:', e)
    return Response.json({ error: e.message || 'Could not write a script' }, { status: 500 })
  }
}
