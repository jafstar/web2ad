// Real brand-color/mascot extraction from an actual screenshot of the
// business's own homepage - the "real footage sourcing" follow-through
// flagged as not-yet-built after docs/real-footage-sourcing.md: their own
// site's real visual identity is fair game (it's the business's own
// asset, unlike Google review photos), unlike anything sourced from a
// third party. Reuses screenshotUrl (lib/adbuilder/htmlTextRenderer.js's
// serverless Chromium) + the same vision-call pattern lib/vision.js
// already established (Gemini primary - more generous image limits -
// Claude fallback).
async function fetchTimeout(url, opts, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)
  try { return await fetch(url, { ...opts, signal: controller.signal }) }
  finally { clearTimeout(timer) }
}

const BRAND_PROMPT = `Look at this screenshot of a real business's website. Identify:
1. Two real colors actually used in this design (a primary brand color and an accent color) - pick colors genuinely present in the page (logo, buttons, headers, backgrounds), not colors you'd expect a business like this to use.
2. Whether there's a distinctive mascot, character illustration, or hand-drawn logo mark (not just plain text/wordmark) - if so, a one-sentence description of it; otherwise null.

Output ONLY a JSON object: {"primaryColor": "#rrggbb", "accentColor": "#rrggbb", "mascotNote": string or null}. Colors must be real hex codes matching what's actually visible - your best real read of the actual pixels, not a generic guess for the business's category.`

function parseJsonObject(text) {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Vision model returned no JSON object')
  return JSON.parse(match[0])
}

function isValidHex(v) {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
}

async function callGeminiVision(imageDataUrl, apiKey) {
  const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
  const [, mediaType, base64Data] = match
  const res = await fetchTimeout('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: BRAND_PROMPT }, { inline_data: { mime_type: mediaType, data: base64Data } }] }],
    }),
  }, 30000)
  if (!res.ok) throw new Error(`Gemini vision ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() ?? '{}'
  return parseJsonObject(text)
}

async function callClaudeVision(imageDataUrl, apiKey) {
  const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
  const [, mediaType, base64Data] = match
  const res = await fetchTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 200,
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } }, { type: 'text', text: BRAND_PROMPT }] }],
    }),
  }, 30000)
  if (!res.ok) throw new Error(`Claude vision ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const text = data.content?.find((b) => b.type === 'text')?.text?.trim() ?? '{}'
  return parseJsonObject(text)
}

// Never throws - real sites fail to screenshot/analyze often enough
// (bot blocks, slow loads, odd redirects) that this must degrade to "no
// real brand data" rather than ever blocking ingestion over it.
export async function extractBrandVisuals(screenshotDataUrl) {
  try {
    const geminiKey = process.env.GEMINI_API_KEY
    const raw = geminiKey ? await callGeminiVision(screenshotDataUrl, geminiKey) : await callClaudeVision(screenshotDataUrl, process.env.ANTHROPIC_API_KEY)
    const colors = [raw.primaryColor, raw.accentColor].filter(isValidHex)
    return { brandColors: colors, mascotNote: typeof raw.mascotNote === 'string' && raw.mascotNote.trim() ? raw.mascotNote.trim() : null }
  } catch (e) {
    console.error('[brandExtract] extraction failed, continuing without real brand data:', e.message)
    return { brandColors: [], mascotNote: null }
  }
}
