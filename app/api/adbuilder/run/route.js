import { createClient } from '../../../../lib/supabase/server'
import { initializeRun, runShotGeneration } from '../../../../lib/adbuilder/shots.js'

// The real "finish" gate: everything up to here (ingest/script/preview)
// is free and open; generating the real multi-shot ad requires a signed-
// in user, same auth already wired for the rest of this app.
export const maxDuration = 60

export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Sign in to finish your ad' }, { status: 401 })

    const { brief, script, stashId, options } = await req.json()
    if (!brief || !script) return Response.json({ error: 'Missing brief or script' }, { status: 400 })

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    // Fast (one Claude call) - the response goes out as soon as this
    // resolves, not after every shot's real generation. The slow part is
    // fired below without awaiting it, so ShotReview's already-existing
    // 3s poll can show shots landing one by one instead of the client
    // sitting on one static spinner for the whole multi-minute run.
    const schema = await initializeRun(runId, brief, script, options, user.id)
    runShotGeneration(runId, brief).catch((e) => console.error(`[adbuilder] run ${runId} generation failed:`, e.message))

    // Record it to the account, via the user's own session so RLS's
    // "insert own projects" policy applies - same pattern 0004's comment
    // describes for genstock's photo projects. The real run/media data
    // lives in the adbuilder_runs table (see runStore.js); this row is
    // just the account-scoped pointer + enough to show in a list.
    const name = brief.businessName || 'Untitled ad'
    const patch = { runId, businessName: brief.businessName, whatTheyDo: brief.whatTheyDo }

    // /api/adbuilder/pending already recorded a placeholder row the moment
    // the confirm screen loaded - convert that one in place (drop the
    // pending status, add the real runId) instead of inserting a second
    // row for the same ad. Falls back to a fresh insert if no placeholder
    // exists (e.g. an older stash created before this existed).
    let updated = false
    if (stashId) {
      const { data: existing } = await supabase
        .from('projects')
        .select('id, data')
        .eq('project_type', 'ad')
        .eq('user_id', user.id)
        .contains('data', { stashId })
        .maybeSingle()
      // Real bug this guards against: refreshing mid-generation and then
      // clicking Generate again is a genuine second attempt on the same
      // stash - without the status check, this would match the SAME row
      // the first attempt already converted and overwrite its runId,
      // orphaning the first run's real completed files with nothing left
      // pointing at them. Only convert a row that's still actually pending.
      if (existing && existing.data?.status === 'pending') {
        const { error: updateError } = await supabase.from('projects')
          .update({ data: { ...existing.data, ...patch, status: undefined } })
          .eq('id', existing.id)
        if (updateError) console.error('adbuilder/run: failed to update pending project row:', updateError.message)
        updated = true
      }
    }

    if (!updated) {
      // Real, live-found problem: a bug (since fixed) let the same free-tier
      // stash trigger this route repeatedly, producing several real,
      // genuinely different generations for the same business with no way
      // to tell them apart in the list. Not worth hard-blocking repeats - a
      // deliberate second take is legitimate - so every project for this
      // exact business name gets a real ordinal ("take") instead.
      const { count } = await supabase.from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('project_type', 'ad')
        .eq('name', name)

      const { error: insertError } = await supabase.from('projects').insert({
        user_id: user.id,
        name,
        project_type: 'ad',
        data: { ...patch, take: (count || 0) + 1 },
      })
      if (insertError) console.error('adbuilder/run: failed to record project row:', insertError.message)
    }

    return Response.json({ runId, schema })
  } catch (e) {
    console.error('adbuilder/run create failed:', e)
    return Response.json({ error: e.message || 'Could not start your ad' }, { status: 500 })
  }
}
