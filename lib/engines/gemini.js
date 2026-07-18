// Ported from designpipe-app/main/gemini.js — prompt-only, no reference
// image, per the real live-tested finding: Gemini's reference+prompt mode
// is aligned as a precise editing tool and produces near-duplicates
// regardless of prompt wording. Genstock has no reference photo concept
// anyway (stock generation, not photo editing), so this is the natural fit.
import { SINGLE_IMAGE_SUFFIX } from '../promptGuards.js'

const MODEL = 'gemini-2.5-flash-image'

async function fetchTimeout(url, opts, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function generateGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const res = await fetchTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${prompt}${SINGLE_IMAGE_SUFFIX}` }] }],
      generationConfig: { responseModalities: ['Image'] },
    }),
  }, 60000)
  if (!res.ok) throw new Error(`Gemini generateContent ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const imagePart = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
  if (!imagePart) throw new Error('Gemini returned no image data')
  return `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`
}
