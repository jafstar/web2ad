// Real Recraft text-to-image — distinct from designpipe-app's
// main/recraft.js, which only ever needed imageToImage (reference-
// conditioned, since that app edits an existing photo). Genstock
// generates from scratch, no reference photo — the actual endpoint for
// that is /v1/images/generations, Recraft's standard prompt-only
// generation call, not imageToImage's multipart reference upload.
import { SINGLE_IMAGE_SUFFIX } from '../promptGuards.js'

const BASE_URL = 'https://external.api.recraft.ai/v1'

async function fetchTimeout(url, opts, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function generateRecraft(prompt, style = 'realistic_image') {
  const apiKey = process.env.RECRAFT_API_KEY
  if (!apiKey) throw new Error('RECRAFT_API_KEY not configured')

  const res = await fetchTimeout(`${BASE_URL}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      prompt: `${prompt}${SINGLE_IMAGE_SUFFIX}`,
      style,
      n: 1,
      response_format: 'b64_json',
    }),
  }, 60000)
  if (!res.ok) throw new Error(`Recraft generations ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const item = data.data?.[0]
  if (!item) throw new Error('Recraft generations returned no images')

  let b64 = item.b64_json
  if (!b64 && item.url) {
    const imgRes = await fetchTimeout(item.url, {}, 20000)
    if (!imgRes.ok) throw new Error(`Recraft result download ${imgRes.status}`)
    b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64')
  }
  if (!b64) throw new Error('Recraft generations returned no usable image data')

  // Confirmed live: this endpoint's b64_json is actually WebP (RIFF
  // magic bytes), not PNG despite no explicit format in the response —
  // mislabeling this as image/png would silently corrupt anything that
  // trusts the declared mime over sniffing content (e.g. Cloudinary).
  return `data:image/webp;base64,${b64}`
}

// Ported from designpipe-app/main/recraft.js — real image-to-image, now
// needed here too since the full Intake reference-photo flow got ported
// over. Same real multipart/form-data contract (the reference must be a
// genuine file upload, not a JSON image_url — that silently fell back to
// prompt-only generation the first time it was built).
export async function generateFromReference({ imageDataUrl, prompt, strength, count, style = 'realistic_image' }) {
  const apiKey = process.env.RECRAFT_API_KEY
  if (!apiKey) throw new Error('RECRAFT_API_KEY not configured')

  const match = /^data:(image\/\w+);base64,(.+)$/.exec(imageDataUrl)
  if (!match) throw new Error('Invalid reference image data URL')
  const [, mimeType, base64] = match
  const buffer = Buffer.from(base64, 'base64')

  const form = new FormData()
  form.append('image', new Blob([buffer], { type: mimeType }), 'reference.png')
  form.append('prompt', `${prompt}${SINGLE_IMAGE_SUFFIX}`)
  form.append('strength', String(strength))
  form.append('n', String(count))
  form.append('style', style)
  form.append('response_format', 'b64_json')

  const res = await fetchTimeout(`${BASE_URL}/images/imageToImage`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  }, 60000)
  if (!res.ok) throw new Error(`Recraft imageToImage ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  if (!data.data?.length) throw new Error('Recraft imageToImage returned no images')

  const mimeOut = style === 'vector_illustration' ? 'image/svg+xml' : 'image/webp'
  return Promise.all(data.data.map(async (d, i) => {
    let b64 = d.b64_json
    if (!b64 && d.url) {
      const imgRes = await fetchTimeout(d.url, {}, 20000)
      if (!imgRes.ok) throw new Error(`Recraft result download ${imgRes.status}`)
      b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64')
    }
    if (!b64) throw new Error('Recraft imageToImage returned no usable image data')
    return { id: `recraft-${i}-${Date.now()}`, dataUrl: `data:${mimeOut};base64,${b64}`, prompt, engine: 'recraft' }
  }))
}

// mode: 'crisp' (cheap/fast, sharper) or 'creative' (slower/pricier).
export async function upscaleImage(dataUrl, mode = 'crisp') {
  const apiKey = process.env.RECRAFT_API_KEY
  if (!apiKey) throw new Error('RECRAFT_API_KEY not configured')

  const endpoint = mode === 'creative' ? 'creativeUpscale' : 'crispUpscale'
  const res = await fetchTimeout(`${BASE_URL}/images/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ image_url: dataUrl, response_format: 'b64_json' }),
  }, 60000)
  if (!res.ok) throw new Error(`Recraft ${endpoint} ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const b64 = data.image?.b64_json
  if (!b64) throw new Error('Recraft upscale returned no image data')
  return `data:image/png;base64,${b64}`
}
