// Ported from designpipe-app/main/imageGen.js — same proven submit/poll/
// download shape. Real difference from the desktop app: the key comes
// from process.env (operator-owned, server-side), not electron-store
// BYOK — genstock is a hosted paid product, not a bring-your-own-key tool.
import { SINGLE_IMAGE_SUFFIX } from '../promptGuards.js'

async function fetchTimeout(url, opts, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// FLUX.2's input_image has no strength/denoise/guidance knob at all
// (confirmed against BFL's own API reference) — unlike Recraft's
// imageToImage strength slider, the ONLY lever for how much the output
// deviates from the reference is the prompt's wording. BFL's own
// prompting guide: preservation language ("keep the rest unchanged")
// locks it near-identical to the reference; transformative language
// ("Reimagine this as...", "Transform X into Y") produces genuine
// deviation. Without this wrapper, feeding a reference photo alongside
// a plain scene description (exactly what the Send-to-Intake loop does)
// produces near-duplicates — the real, confirmed cause "the loop doesn't
// work well" for Flux specifically, unlike Recraft which has an actual
// strength dial for this. `mode` mirrors the Exact/Similar/Category
// slider in Intake (see lib/variationModes.js) — since there's no real
// parameter to reach for, the wording itself is the dial.
function referenceConditionedPrompt(prompt, mode = 'similar') {
  if (mode === 'exact') {
    return `Recreate this reference photo as closely as possible, applying only this change: ${prompt}. Keep the composition, subject, and framing exactly the same — minimal deviation from the reference photo.`
  }
  if (mode === 'category') {
    // Real, live-caught issue: a softer "use as loose inspiration" wrapper
    // wasn't enough — genstock's photo analysis produces a compositionally
    // specific description (exact framing/horizon/lighting), and that
    // concrete detail was winning out over the wrapper's vaguer intent,
    // so Exact and Category ended up looking near-identical. This version
    // explicitly calls out that the following text describes the OLD
    // composition and must not be treated as a layout instruction.
    return `Generate a brand new image. The subject/category is: ${prompt}. The text above describes the ORIGINAL reference photo's composition, camera angle, and framing — do NOT recreate that layout. Invent a completely different composition, angle, and framing around that general subject instead. Only the general subject matter should carry over from the reference photo.`
  }
  return `Reimagine this reference photo as a new image: ${prompt}. Meaningful creative reinterpretation — vary the composition and framing — while keeping the same general subject recognizable.`
}

// Generated image URLs expire in 10 minutes, so we download+base64-encode
// immediately rather than storing the delivery URL — same real constraint
// the desktop app and design_mockup_pipeline.mjs work around.
// `referenceImageDataUrl`, when given, makes this a real reference-
// conditioned call — see referenceConditionedPrompt() above for why the
// prompt itself (not a parameter) is what keeps it from near-duplicating.
export async function generateFlux(prompt, width = 768, height = 768, referenceImageDataUrl = null, variationMode = 'similar') {
  const apiKey = process.env.BFL_API_KEY
  if (!apiKey) throw new Error('BFL_API_KEY not configured')

  const body = {
    prompt: `${referenceImageDataUrl ? referenceConditionedPrompt(prompt, variationMode) : prompt}${SINGLE_IMAGE_SUFFIX}`,
    width,
    height,
  }
  if (referenceImageDataUrl) {
    const match = /^data:image\/\w+;base64,(.+)$/.exec(referenceImageDataUrl)
    body.input_image = match ? match[1] : referenceImageDataUrl
  }

  const submitRes = await fetchTimeout('https://api.bfl.ai/v1/flux-2-pro-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'application/json', 'x-key': apiKey },
    body: JSON.stringify(body),
  }, 20000)
  if (!submitRes.ok) throw new Error(`FLUX submit ${submitRes.status}: ${(await submitRes.text()).slice(0, 300)}`)
  const { polling_url } = await submitRes.json()
  if (!polling_url) throw new Error('FLUX returned no polling_url')

  const start = Date.now()
  while (Date.now() - start < 120000) {
    await new Promise((r) => setTimeout(r, 1500))
    const pollRes = await fetchTimeout(polling_url, { headers: { accept: 'application/json', 'x-key': apiKey } }, 15000)
    if (!pollRes.ok) throw new Error(`FLUX poll ${pollRes.status}: ${(await pollRes.text()).slice(0, 300)}`)
    const data = await pollRes.json()
    if (data.status === 'Ready') {
      const imgUrl = data.result?.sample
      if (!imgUrl) throw new Error('FLUX ready but no result.sample URL')
      const imgRes = await fetchTimeout(imgUrl, {}, 20000)
      if (!imgRes.ok) throw new Error(`FLUX image download ${imgRes.status}`)
      const buf = Buffer.from(await imgRes.arrayBuffer())
      return `data:image/jpeg;base64,${buf.toString('base64')}`
    }
    if (data.status === 'Error' || data.status === 'Failed') throw new Error(`FLUX generation failed: ${data.status}`)
  }
  throw new Error('FLUX generation timed out after 120s')
}
