// Ported from designpipe-app/main/vision.js — operator-owned keys
// (ANTHROPIC_API_KEY/GEMINI_API_KEY env vars). Order flipped from
// designpipe-app's Claude-first: Gemini is primary here per Mayor's call
// — also sidesteps Claude's tighter ~5MB vision API limit that a
// full-res screenshot upload hit live tonight, since Gemini's image
// limits are more generous. Claude is the fallback.
async function fetchTimeout(url, opts, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// Real redesign, 3rd pass. Two earlier attempts both failed live:
// (1) asking Gemini to self-grade 5 levels of "how detailed" its own
// prose should be produced text that read different without carrying
// different information; (2) mechanically concatenating 3 extracted
// fields (subject/composition/category) with code was too rigid/narrow
// to produce genuinely rich alternatives. What actually worked, tested
// directly against Gemini: hand it the real Exact text as a concrete
// anchor and let it CREATIVELY GENERATE Similar/Category as a separate,
// unconstrained text-only step — not another extraction task. Similar
// = same photographic detail/quality, different specific scene within
// the same theme (different geography/angle/lighting). Category = a
// genuinely different, more conceptual/thematic reinterpretation. This
// is now a real 2-step pipeline: image analysis for Exact, then a
// text-only creative-generation call for Similar/Category.
const EXACT_PROMPT = 'Describe this photo\'s actual location/setting and concrete objects — the precise composition, camera angle, framing, and lighting, every visible detail grounded in what you can actually see. One tight paragraph, under 40 words, usable directly as an image-generation prompt. Output ONLY that description, nothing else.'

function variantsPrompt(exactText) {
  return `I have 3 categories: 1) Exact, 2) Similar, 3) Category. Here is #1, the exact description of a reference photo: "${exactText}"

Generate #2 and #3, each as exactly 3 distinct options:
- Similar (3 options): each a different specific scene that keeps the same photographic quality and level of visual detail as #1, but changes the specific content (different geography, subject placement, lighting, or angle) while staying in the same general theme.
- Category (3 options): each a broader, more conceptual or thematic reinterpretation — the general feeling or abstract representation of the scene, with real creative license. The 3 options should be genuinely distinct directions from each other, not variations on one idea.

Each option must be a single self-contained image-generation prompt, under 40 words. Output ONLY a JSON object: {"similar": ["...", "...", "..."], "category": ["...", "...", "..."]}, nothing else.`
}

// Real bug, live-caught: despite the prompt saying "Output ONLY JSON,"
// Gemini sometimes prefaces it with prose ("The photo shows...") anyway
// — stripping markdown fences alone isn't enough since there's no fence
// to strip, just plain text before the object. Finding the first {...}
// substring is robust to both cases (fenced or not, prefaced or not)
// rather than assuming the whole trimmed response IS the object.
function parseJsonObject(text) {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`Vision model returned no JSON object: ${stripped.slice(0, 200)}`)
  const parsed = JSON.parse(match[0])
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Vision model returned unexpected format')
  return parsed
}

function threeOptions(list, fallback) {
  const arr = Array.isArray(list) ? list.filter((s) => typeof s === 'string' && s.trim()) : []
  while (arr.length < 3) arr.push(fallback)
  return arr.slice(0, 3)
}

async function fetchSimilarAndCategory(exactText, apiKey) {
  const res = await fetchTimeout('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: variantsPrompt(exactText) }] }],
    }),
  }, 30000)
  if (!res.ok) throw new Error(`Gemini variants ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() ?? '{}'
  const { similar, category } = parseJsonObject(text)
  return { similar: threeOptions(similar, exactText), category: threeOptions(category, exactText) }
}

// Word-tagging moved to lib/wordTagsClient.js — a real client-side NLP
// tagger (compromise), not an AI call, so it's not part of this
// server-side analysis pipeline at all anymore (was a 3rd sequential/
// parallel Gemini call, real live-noticed latency for something that
// doesn't need a model — part-of-speech tagging is a solved, fast,
// local problem).
async function generateVariantsAndTags(exactText, apiKey) {
  const variants = await fetchSimilarAndCategory(exactText, apiKey)
  return { exact: exactText, ...variants }
}

async function describeWithClaude(imageDataUrl) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!match) throw new Error('Unexpected image format')
  const [, mediaType, base64Data] = match

  const res = await fetchTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: EXACT_PROMPT },
        ],
      }],
    }),
  }, 30000)
  if (!res.ok) throw new Error(`Claude vision ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const exactText = data.content?.find((b) => b.type === 'text')?.text?.trim() ?? ''
  if (!exactText) throw new Error('Claude vision returned no description')
  // Claude only gets us the Exact step here (no ANTHROPIC path for the
  // creative step below) — Similar/Category still come from Gemini, so
  // this fallback only fully works when both keys are configured.
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) return { exact: exactText, similar: [exactText, exactText, exactText], category: [exactText, exactText, exactText], wordTags: null }
  return generateVariantsAndTags(exactText, geminiKey)
}

async function describeWithGemini(imageDataUrl) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('No vision key configured (ANTHROPIC_API_KEY or GEMINI_API_KEY)')
  const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!match) throw new Error('Unexpected image format')
  const [, mediaType, base64Data] = match

  const res = await fetchTimeout('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: EXACT_PROMPT }, { inline_data: { mime_type: mediaType, data: base64Data } }] }],
    }),
  }, 30000)
  if (!res.ok) throw new Error(`Gemini vision ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const exactText = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() ?? ''
  if (!exactText) throw new Error('Gemini vision returned no description')
  return generateVariantsAndTags(exactText, apiKey)
}

// Returns { exact: string, similar: [3 strings], category: [3 strings] }.
// Exact is a single description (there's only one literal reading of the
// photo); Similar and Category each come back as 3 distinct options for
// the user to pick from in Intake — see IntakeSection.jsx.
export async function describePhoto(imageDataUrl) {
  if (process.env.GEMINI_API_KEY) return describeWithGemini(imageDataUrl)
  const viaClaude = await describeWithClaude(imageDataUrl)
  if (viaClaude) return viaClaude
  throw new Error('No vision key configured (GEMINI_API_KEY or ANTHROPIC_API_KEY)')
}
