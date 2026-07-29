import { createClient } from '../../../../lib/supabase/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { buildBeatAd } from '../../../../lib/adbuilder/beatPipeline.js'

// Step 3 of the v2 funnel - the real signup gate (same rule as v1's
// /api/adbuilder/run: generation costs real money, free tier stops at the
// step-2 preview). Runs the full beat pipeline synchronously and returns
// the finished, downloadable ad in one response - v2 has no per-shot
// editing UI, so there's no need for v1's poll-based ShotReview/
// adbuilder_runs schema here, just a single long request behind a spinner.
export const maxDuration = 600

export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Sign in to generate your full ad' }, { status: 401 })

    const { brief, beats, atmosphere, stashId } = await req.json()
    if (!brief || !beats?.length) return Response.json({ error: 'Missing brief or beats' }, { status: 400 })

    // Real bug this guards against, live-caught: the beatfinish page never
    // invalidated its stash or swapped its URL after a successful
    // generation, so bouncing back through /login (which auto-redirects
    // straight through if already signed in) could replay the exact same
    // still-valid stash and fire a second real, costly generation for the
    // same ad. Claiming the stash - delete it and check a row actually
    // came back - BEFORE spending anything makes only the first request
    // to reach here actually proceed; a replay (or a fast double-click)
    // finds nothing left to claim and fails immediately, before any real
    // API cost. Best-effort no-op if no stashId was sent (e.g. a retry
    // after a genuine failure where the page still holds stashData).
    let claimedStashRow = null
    if (stashId) {
      const admin = createAdminClient()
      const { data: claimed } = await admin.from('adbuilder_stash').delete().eq('id', stashId).select('id, brief, script, preview_image_url')
      if (!claimed?.length) return Response.json({ error: 'This ad has already been generated, or your link has expired.' }, { status: 409 })
      claimedStashRow = claimed[0]
    }

    const runId = `beat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    let result
    try {
      result = await buildBeatAd(runId, brief, { beats, atmosphere })
    } catch (e) {
      // A genuine failure (transient Hailuo error, etc.) has nothing to
      // do with replay protection - restore the claimed stash so the
      // user can retry from the same confirm screen instead of losing
      // their ad data over an unrelated error.
      if (claimedStashRow) {
        const admin = createAdminClient()
        await admin.from('adbuilder_stash').insert(claimedStashRow).then(null, (restoreErr) => console.error('adbuilder/beatrun: failed to restore stash after error:', restoreErr.message))
      }
      throw e
    }

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
          // Full brief/beats/atmosphere kept here (not just the summary
          // fields above) so a later "Fork to Edit" has everything it
          // needs to regenerate individual beats and re-composite -
          // see beatedit/fork/route.js, which clones this data verbatim.
          brief,
          atmosphere: result.atmosphere,
          beats: result.beats,
          videoUrl: result.url,
          sceneImageUrl: result.beats?.[0]?.keyframeUrl || null,
          durationSeconds: result.durationSeconds,
          beatCount: result.beatCount,
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
