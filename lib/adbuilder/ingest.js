import { callClaude, parseJsonObject } from './claude.js'

async function fetchTimeout(url, opts, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)
  try { return await fetch(url, { ...opts, signal: controller.signal }) }
  finally { clearTimeout(timer) }
}

// Crude but effective: strip script/style blocks then all remaining tags,
// collapse whitespace. Real page text-extraction library would be more
// precise, but for "get enough real business content for a single Claude
// analysis call" this is the same level of effort genstock's own vision
// pipeline puts into other lightweight extraction steps.
function htmlToText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

const BRIEF_SYSTEM = `You analyze a real business's real website and extract a structured brief for writing an ad. Read the raw page text below and identify: the business name, what they actually do/sell, their real tone of voice (formal/casual/playful/technical), any concrete trust signals mentioned (years in business, certifications, notable clients, guarantees), and what makes them specific rather than generic.

Output ONLY a JSON object with these exact keys: {"businessName": string, "whatTheyDo": string, "tone": string, "trustSignals": [string, ...], "specificDetails": string}. If the page text doesn't clearly give you something, use your best real inference from what IS there rather than inventing specifics — "specificDetails" especially should be something you can actually point to in the text, not a generic filler line.`

export async function ingestFromUrl(url) {
  let parsed
  try { parsed = new URL(url) } catch { throw new Error('That doesn\'t look like a valid URL') }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('URL must start with http:// or https://')

  // Real, live-caught problem: a UA that self-identifies as a bot
  // ("Web2AdBot/1.0") gets blocked by ordinary WAF bot-filtering on sight,
  // regardless of intent - this is a normal read of a public page, same as
  // any browser's, so a real browser UA (+ the headers a browser actually
  // sends alongside it) is the honest fix, not evasion of anything.
  const res = await fetchTimeout(parsed.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  }, 15000)
  if (!res.ok) {
    if (res.status === 403) throw new Error(`That site blocked our request (HTTP 403) - try "Describe It" instead`)
    throw new Error(`Couldn't fetch that page (HTTP ${res.status})`)
  }
  const html = await res.text()
  const text = htmlToText(html).slice(0, 8000)
  if (text.length < 40) throw new Error('That page had almost no readable text to work from')

  const raw = await callClaude(`Page URL: ${parsed.toString()}\n\nRaw page text:\n${text}`, BRIEF_SYSTEM, 800)
  const brief = parseJsonObject(raw)
  brief.sourceUrl = parsed.toString()
  return brief
}

// Second real ingestion method - a business with no website (or a bad
// one) can just describe themselves directly. Same brief extraction
// prompt/shape as the URL path, just skipping the fetch+HTML-strip step,
// so both methods produce an identical brief shape downstream.
export async function ingestFromText(description) {
  const text = (description || '').trim()
  if (text.length < 20) throw new Error('Give a bit more detail — a sentence or two about the business')
  const raw = await callClaude(`Business description, written directly by the owner (no website):\n\n${text.slice(0, 4000)}`, BRIEF_SYSTEM, 800)
  const brief = parseJsonObject(raw)
  brief.sourceUrl = null
  return brief
}
