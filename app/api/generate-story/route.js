import { createClient } from '../../../lib/supabase/server'
import { createAdminClient } from '../../../lib/supabase/admin'
import { debitCredits, getBalance, CREDIT_COST_PER_IMAGE, CREDITS_DISABLED_FOR_TESTING } from '../../../lib/credits'
import { uploadToCloudinary } from '../../../lib/cloudinary'
import { generateFlux } from '../../../lib/engines/flux'
import { ROUND_LIMIT_PER_PROJECT, isWhitelisted } from '../../../lib/limits'

// Story type's real generation path - distinct from /api/generate's
// single-prompt-multi-count shape because the actual mechanism is
// different: one reference-conditioned Flux call PER SCENE the user
// wrote, not N variations of one prompt. Same 'exact' mode wrapper
// (generateFlux's referenceConditionedPrompt) proven across tonight's
// era-remix/walk-cycle/illustrated-classic tests - "keep everything,
// apply only this one change" is exactly right for holding identity
// across a real scene sequence.
export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const { referenceImageDataUrl, scenes, projectId } = await request.json()
  if (!referenceImageDataUrl) return Response.json({ error: 'referenceImageDataUrl is required' }, { status: 400 })
  const sceneList = (scenes || []).map((s) => s.trim()).filter(Boolean)
  if (sceneList.length === 0) return Response.json({ error: 'At least one scene is required' }, { status: 400 })

  if (projectId && !isWhitelisted(user.email)) {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('data')
      .eq('id', projectId)
      .single()
    if (projectError) return Response.json({ error: projectError.message }, { status: 500 })
    const roundCount = new Set((project?.data?.gallery ?? []).map((g) => g.round ?? 1)).size
    if (roundCount >= ROUND_LIMIT_PER_PROJECT) {
      return Response.json({ error: `This project has reached the ${ROUND_LIMIT_PER_PROJECT}-round limit for the beta.`, code: 'round_limit', limit: ROUND_LIMIT_PER_PROJECT }, { status: 403 })
    }
  }

  const admin = createAdminClient()
  const balance = await getBalance(admin, user.id)
  const affordable = CREDITS_DISABLED_FOR_TESTING ? sceneList.length : Math.min(sceneList.length, Math.floor(balance / CREDIT_COST_PER_IMAGE))
  if (affordable <= 0) return Response.json({ error: 'insufficient_credits', balance }, { status: 402 })
  const runScenes = sceneList.slice(0, affordable)

  const uploadFolder = `genstock/${user.id}`
  const settled = await Promise.allSettled(runScenes.map((sceneText, i) =>
    generateFlux(sceneText, 640, 480, referenceImageDataUrl, 'exact').then(async (dataUrl) => {
      const uploaded = await uploadToCloudinary(dataUrl, uploadFolder)
      return { id: `story-${i}-${Date.now()}`, engine: 'flux', prompt: sceneText, ...uploaded }
    })
  ))

  const results = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value)
  const failures = settled.filter((s) => s.status === 'rejected').map((s) => s.reason?.message || 'unknown error')

  let newBalance = balance
  if (results.length > 0 && !CREDITS_DISABLED_FOR_TESTING) {
    newBalance = await debitCredits(admin, user.id, results.length, { type: 'round', roundTier: 'low' })
  }

  return Response.json({ results, failures, balance: newBalance, projectId })
}
