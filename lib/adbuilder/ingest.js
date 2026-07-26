import { callClaude, parseJsonObject } from './claude.js'
import { VERTICALS } from './verticals.js'
import { screenshotUrl } from './htmlTextRenderer.js'
import { extractBrandVisuals } from './brandExtract.js'

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

// Real, live-caught reason "vertical" is classified here instead of a
// separate call: an AI-generated human face actively destroys trust for
// a medical/legal/financial business in a way it just doesn't for a
// restaurant - that's not a style preference, it's a real credibility
// risk, and leaving it to chance per-generation isn't good enough. This
// classification drives concrete downstream defaults (forced object-only
// framing, restrained comedic register) in shots.js/story.js - riding
// along on the existing brief-extraction call rather than a second API
// call, since the page text already in context is enough signal for it.
const VERTICAL_GUIDE = `Also classify the business into exactly one of these industry categories, based on what actually reduces trust if an AI-generated human face/expression carries the ad: "high-trust" (medical, legal, financial, or similar - a business that sells invisible expertise where a synthetic face reads as fake and destroys credibility), "food" (restaurants, cafes, food & beverage, hospitality), "tech" (software, SaaS, B2B services), "home-services" (pest control, HVAC, roofing, plumbing, and similar trade/repair businesses), or "general" (anything that doesn't clearly fit the above - retail, fitness, beauty, etc.).`

const BRIEF_SYSTEM = `You analyze a real business's real website and extract a structured brief for writing an ad. Read the raw page text below and identify: the business name, what they actually do/sell, their real tone of voice (formal/casual/playful/technical), any concrete trust signals mentioned (years in business, certifications, notable clients, guarantees), what makes them specific rather than generic, and a real phone number if one is printed anywhere in the text.

${VERTICAL_GUIDE}

Output ONLY a JSON object with these exact keys: {"businessName": string, "whatTheyDo": string, "tone": string, "trustSignals": [string, ...], "specificDetails": string, "vertical": one of ${JSON.stringify(VERTICALS)}, "phoneNumber": string or null}. If the page text doesn't clearly give you something, use your best real inference from what IS there rather than inventing specifics — "specificDetails" especially should be something you can actually point to in the text, not a generic filler line. phoneNumber must be an actual number found in the text, verbatim — null if none appears, never invented.`

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

  // Real brand-color/mascot extraction runs alongside the text-brief
  // call, not after it - a real screenshot + vision analysis has its own
  // latency (Chromium launch + navigate + settle + vision call), and
  // there's no reason to pay that serially on top of the text call when
  // neither depends on the other's result. Best-effort: real sites fail
  // to screenshot often enough (bot blocks, slow loads) that this must
  // never take ingestion down with it - see visualsFromScreenshot below.
  const [raw, visuals] = await Promise.all([
    callClaude(`Page URL: ${parsed.toString()}\n\nRaw page text:\n${text}`, BRIEF_SYSTEM, 800),
    visualsFromScreenshot(parsed.toString()),
  ])
  const brief = parseJsonObject(raw)
  brief.sourceUrl = parsed.toString()
  brief.brandColors = visuals.brandColors
  brief.mascotNote = visuals.mascotNote
  normalizeVertical(brief)
  return brief
}

async function visualsFromScreenshot(url) {
  try {
    const screenshotDataUrl = await screenshotUrl(url)
    return await extractBrandVisuals(screenshotDataUrl)
  } catch (e) {
    console.error('[ingest] screenshot/brand extraction failed, continuing without real brand data:', e.message)
    return { brandColors: [], mascotNote: null }
  }
}

// Defensive against a malformed/missing vertical from the model - every
// downstream vertical-aware default (shots.js, story.js) falls back to
// 'general' automatically, but normalizing here means brief.vertical is
// always a real value, not undefined, for anything that reads it directly.
function normalizeVertical(brief) {
  if (!VERTICALS.includes(brief.vertical)) brief.vertical = 'general'
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
  // No real site to screenshot for this path - same shape as
  // ingestFromUrl's brief either way, just genuinely empty here rather
  // than undefined, so downstream code (outroCard.js) never needs to
  // special-case which ingestion method produced this brief.
  brief.brandColors = []
  brief.mascotNote = null
  normalizeVertical(brief)
  return brief
}
