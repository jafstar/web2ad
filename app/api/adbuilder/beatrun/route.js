import { createClient } from '../../../../lib/supabase/server'
import { buildBeatAd } from '../../../../lib/adbuilder/beatPipeline.js'

// Step 3 of the v2 funnel - the real signup gate (same rule as v1's
// /api/adbuilder/run: generation costs real money, free tier stops at the
// step-2 preview). Runs the full beat pipeline synchronously and returns
// the finished, downloadable ad in one response - v2 has no per-shot
// editing UI, so there's no need for v1's poll-based ShotReview/
// adbuilder_runs schema here, just a single long request behind a spinner.
export const maxDuration = 300

export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Sign in to generate your full ad' }, { status: 401 })

    const { brief, beats, atmosphere } = await req.json()
    if (!brief || !beats?.length) return Response.json({ error: 'Missing brief or beats' }, { status: 400 })

    const runId = `beat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const result = await buildBeatAd(runId, brief, { beats, atmosphere })

    // Record it to "My Ads" only once the real video exists - v2 has no
    // in-progress/pending state to track (the whole build already
    // happened above, synchronously), so unlike v1 there's no placeholder
    // row and no adbuilder_runs schema involved at all. Via the user's
    // own session so RLS's "insert own projects" policy applies, same as
    // v1's insert in run/route.js. Best-effort: the ad itself already
    // succeeded, so a failed insert here shouldn't fail the response.
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
          videoUrl: result.url,
          sceneImageUrl: result.beats?.[0]?.keyframeUrl || null,
          durationSeconds: result.durationSeconds,
          beatCount: result.beatCount,
          atmosphere: result.atmosphere,
          take: (count || 0) + 1,
        },
      })
      if (insertError) console.error('adbuilder/beatrun: failed to record project row:', insertError.message)
    } catch (e) {
      console.error('adbuilder/beatrun: failed to record project row:', e.message)
    }

    return Response.json({ runId, ...result })
  } catch (e) {
    console.error('adbuilder/beatrun failed:', e)
    return Response.json({ error: e.message || 'Could not generate your full ad' }, { status: 500 })
  }
}
