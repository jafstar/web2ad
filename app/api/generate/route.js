import { createClient } from '../../../lib/supabase/server'
import { createAdminClient } from '../../../lib/supabase/admin'
import { debitCredits, getBalance, CREDIT_COST_PER_IMAGE, CREDITS_DISABLED_FOR_TESTING } from '../../../lib/credits'
import { uploadToCloudinary } from '../../../lib/cloudinary'
import { generateFlux } from '../../../lib/engines/flux'
import { generateGemini } from '../../../lib/engines/gemini'
import { generateFromReference } from '../../../lib/engines/recraft'
import { diversityHint, frontBackHint } from '../../../lib/promptGuards'
import { ROUND_LIMIT_PER_PROJECT, isWhitelisted } from '../../../lib/limits'

// Real port of designpipe-app's main.js images:generateBatch handler —
// same parameter shape (prompt, referenceImageDataUrl, size, fluxCount,
// recraftCount, recraftStrength, recraftStyle, geminiCount), same
// concurrent-engines-via-Promise.all structure, same "Flux/Gemini are
// prompt-only explorers, Recraft is the one reference-conditioned engine"
// split confirmed live in that app. Real differences: no live progress
// events (see lib/ipcShim.js's note — a real, not-yet-closed gap), every
// result gets credit-debited + uploaded to Cloudinary instead of staying
// as base64, and a balance pre-check gates the whole batch before any
// real API cost is spent.
export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const { prompt, referenceImageDataUrl, size, fluxCount = 0, recraftCount = 0, recraftStrength = 0.5, recraftStyle = 'realistic_image', geminiCount = 0, variationMode = 'similar', projectId, frontBack = false } = await request.json()
  if (!prompt?.trim()) return Response.json({ error: 'prompt is required' }, { status: 400 })
  const perImageHint = frontBack ? frontBackHint : diversityHint

  // Real cost-risk gate (see lib/limits.js) - checked before any API spend,
  // same discipline as the balance pre-check below. One generate call is
  // one new round (CritiqueSection.jsx assigns round numbers off the
  // gallery's current max), so the round count IS the gallery's distinct
  // round count, not the request size.
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
  const requestedTotal = fluxCount + recraftCount + geminiCount
  const balance = await getBalance(admin, user.id)
  // TEMPORARY, see lib/credits.js — testing without credits gating or
  // spending the balance. Real generation still runs in full either way.
  const affordable = CREDITS_DISABLED_FOR_TESTING ? requestedTotal : Math.min(requestedTotal, Math.floor(balance / CREDIT_COST_PER_IMAGE))
  if (affordable <= 0) {
    return Response.json({ error: 'insufficient_credits', balance }, { status: 402 })
  }

  // Trim proportionally down to what's affordable if the request exceeds
  // the balance — same "don't spend real API cost on what can't be paid
  // for" principle as the balance check itself, just applied per-engine
  // instead of an all-or-nothing refusal.
  let remaining = affordable
  const take = (n) => { const t = Math.min(n, remaining); remaining -= t; return t }
  const runFlux = take(fluxCount)
  const runRecraft = take(recraftCount)
  const runGemini = take(geminiCount)

  const uploadFolder = `genstock/${user.id}`

  const fluxPromise = runFlux > 0
    ? Promise.allSettled(Array.from({ length: runFlux }, (_, i) =>
        generateFlux(`${prompt}${perImageHint(i)}`, size?.width, size?.height, referenceImageDataUrl, variationMode).then(async (dataUrl) => {
          const uploaded = await uploadToCloudinary(dataUrl, uploadFolder)
          return { id: `flux-${i}-${Date.now()}`, engine: 'flux', prompt, ...uploaded }
        })
      ))
    : Promise.resolve([])

  // Fx "180 Deg" mode needs a genuinely different prompt per image (front
  // vs. back), but Recraft's imageToImage takes one prompt for its whole
  // `n` batch — so front/back mode runs it as two separate n:1 calls
  // instead of the usual single n:runRecraft call.
  const recraftPromise = runRecraft > 0 && referenceImageDataUrl
    ? (frontBack
        ? Promise.all(Array.from({ length: runRecraft }, (_, i) =>
            generateFromReference({ imageDataUrl: referenceImageDataUrl, prompt: `${prompt}${perImageHint(i)}`, strength: recraftStrength, count: 1, style: recraftStyle })
              .catch((e) => [{ status: 'rejected', reason: e }])
          )).then((batches) => batches.flat())
        : generateFromReference({ imageDataUrl: referenceImageDataUrl, prompt, strength: recraftStrength, count: runRecraft, style: recraftStyle })
            .catch((e) => [{ status: 'rejected', reason: e }])
      )
        // Real bug, live-caught: `{ ...r, ...uploaded }` kept spreading r's
        // raw base64 `dataUrl` (200KB-4MB per image) into the saved gallery
        // item, since `uploaded` only has a `url` key — nothing ever
        // overwrote/removed the original field. One project's `data`
        // column reached 10.2MB from this, causing real Postgres statement
        // timeouts on every save (a full-column-replace, not a patch).
        // `dataUrl` is dropped explicitly now — only the lightweight
        // Cloudinary reference should ever get persisted.
        .then((results) => Promise.allSettled(results.map(async (r) => {
          if (r.status === 'rejected') throw r.reason
          const { dataUrl, ...rest } = r
          return { ...rest, ...(await uploadToCloudinary(dataUrl, uploadFolder)) }
        })))
    : Promise.resolve([])

  const geminiPromise = runGemini > 0
    ? Promise.allSettled(Array.from({ length: runGemini }, (_, i) =>
        generateGemini(`${prompt}${perImageHint(i)}`).then(async (dataUrl) => {
          const uploaded = await uploadToCloudinary(dataUrl, uploadFolder)
          return { id: `gemini-${i}-${Date.now()}`, engine: 'gemini', prompt, ...uploaded }
        })
      ))
    : Promise.resolve([])

  const [fluxSettled, recraftSettled, geminiSettled] = await Promise.all([fluxPromise, recraftPromise, geminiPromise])
  const allSettled = [...fluxSettled, ...recraftSettled, ...geminiSettled]

  const results = allSettled.filter((s) => s.status === 'fulfilled').map((s) => s.value)
  const failures = allSettled.filter((s) => s.status === 'rejected').map((s) => s.reason?.message || 'unknown error')

  let newBalance = balance
  if (results.length > 0 && !CREDITS_DISABLED_FOR_TESTING) {
    newBalance = await debitCredits(admin, user.id, results.length, { type: 'round', roundTier: 'low' })
  }

  return Response.json({ results, failures, balance: newBalance, projectId })
}
