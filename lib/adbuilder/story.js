// Real Council-based script writer, replacing the old single-Claude-call
// writeScript - validated live 2026-07-25 against Just Chicken's real
// brief (which the flat version turned into a generic, incoherent
// 4-unrelated-shot ad). Same mechanism story-glue's build-ad-story.mjs
// already proved for Chapmans: draft -> refine -> Xlectic critique
// (Arbiter/Realist/Visionary) -> lead-edit, plus a 4th Jester voice on
// Grok explicitly hunting for a real joke/surprise rather than a
// generic "make it funnier" note. One coherent character/throughline
// comes out of this by construction, which is also what fixes the shot
// breakdown's coherence - see generateShotBreakdown in shots.js, which
// now builds shots FROM this story instead of inventing them independently.
import { callClaude } from './claude.js'
import { callGemini } from './models/gemini.js'
import { callChatGPT } from './models/chatgpt.js'
import { callGrok } from './models/grok.js'
import { STYLE_TAGS } from './styleTags.js'

export { STYLE_TAGS }

const STYLE_HINTS = {
  funny: 'Lean hard into real comedy - a genuine joke or absurd specific detail, not just a light tone.',
  dramatic: 'Real stakes and tension - treat this like a mini high-stakes moment, not a light aside.',
  animals: 'Feature a real animal as a central character in the story (a pet, a mascot, a wild animal) - the animal should matter to the plot, not just appear as decoration.',
  superhero: `Frame this as a mini superhero story - the business or its product/service is the "power" that solves a real problem, with real stakes and a hero moment.`,
  heartwarming: `A genuine emotional, feel-good moment - something that would make someone say "aw" unprompted.`,
  nostalgic: `Ground this in a specific nostalgic memory or throwback moment - something that evokes "remember when..."`,
  absurd: 'Go genuinely weird/surreal - an exaggerated, almost-unbelievable premise played completely straight.',
  prestige: 'Elevated, cinematic tone - treat the business like a premium brand story, confident and understated, not jokey.',
}

// Real, live-caught pacing bug: a 60-word draft with two quoted dialogue
// exchanges measured at 25.2 real seconds of synthesized speech, not the
// ~24s a flat 150wpm estimate would suggest - dialogue attribution and
// dramatic beats read slower than plain prose. Tightened the target down
// and called out dialogue specifically so the model budgets for its own
// pacing, not just word count. (The export step now also survives a miss
// on this by extending the video rather than truncating narration - this
// is about making the miss rarer, not the only safety net.)
const WRITE_SYSTEM = `You are a writer crafting a short story that will double as ad narration for a real business. Write real narrative prose - specific sensory detail, real tension, a character who wants something and either gets it or doesn't - not marketing copy with a plot veneer. Favor short, punchy sentences that read well spoken aloud. This is a 15-20 second video ad, so the whole thing must be readable aloud in under 20 seconds - target 35-45 words, not 200-300. If the story includes quoted dialogue, budget fewer words than that - dialogue with attribution ("...," he said) and dramatic pauses reads noticeably slower than plain narration of the same length.`

function briefText(brief) {
  return `Business: ${brief.businessName}\nWhat they do: ${brief.whatTheyDo}\nTone: ${brief.tone}\nTrust signals: ${(brief.trustSignals || []).join('; ')}`
}

export async function writeAdStory(brief, styleTag) {
  const styleHint = STYLE_HINTS[styleTag]
  const draftBrief = `${briefText(brief)}\n\nWrite a short (35-45 word, fewer if it includes dialogue) real short story - not ad copy - with a beginning, middle, and end, that doubles as ad narration for this business. One clear throughline: pick ONE customer/character and follow them through one real moment (want/need -> they get it -> the payoff). End with a natural, ungimmicky mention of the business - it should feel like part of the story's own world, not a tacked-on slogan.${styleHint ? ` Style direction: ${styleHint}` : ''}`

  const claudeDraft = await callClaude(draftBrief, WRITE_SYSTEM, 700)
  const draft = await callGemini(
    `${draftBrief}\n\nHere is a first draft - read it, then refine it into a stronger version of the SAME story. Preserve the events; improve the prose, tighten pacing, keep it under 45 words (fewer if it has dialogue).\n\nDraft:\n\n${claudeDraft}`,
    WRITE_SYSTEM, process.env.GEMINI_API_KEY
  )

  const FOCUS = 'Stay focused on this specific draft - concrete, specific craft feedback, not vague praise. Point to an actual word or moment. 2-3 sentences.'
  const ARBITER = `You are The Arbiter - find the single most important structural problem: a missing want/stakes, an unearned turn, a promise the story makes and doesn't keep. ${FOCUS}`
  const REALIST = `You are The Realist - call out anywhere this asks the reader to accept something without earning it, or anything a real listener would tune out on. ${FOCUS}`
  const VISIONARY = `You are The Visionary - find where this played it too safe; a beat that could be stranger, bigger, more memorable. ${FOCUS}`
  const JESTER = `You are The Jester, a professional comedy writer. This ad is allowed to be genuinely funny. Find the ONE place a real joke, a surprising turn, or a funnier specific detail would make this more shareable - name the actual line and what should replace it. ${FOCUS}`

  const [arbiter, realist, visionary, jester] = await Promise.all([
    callClaude(`Draft:\n\n${draft}`, ARBITER, 600),
    callGemini(`Draft:\n\n${draft}`, REALIST, process.env.GEMINI_API_KEY),
    callChatGPT(`Draft:\n\n${draft}`, VISIONARY, process.env.CHATGPT_API_KEY),
    callGrok(`Draft:\n\n${draft}`, JESTER, process.env.XAI_API_KEY)
      .catch((e) => { console.error('[adbuilder] Jester (Grok) failed, continuing without it:', e.message); return null }),
  ])

  const notesText = [
    `Arbiter: ${arbiter}`,
    `Realist: ${realist}`,
    `Visionary: ${visionary}`,
    jester ? `Jester: ${jester}` : null,
  ].filter(Boolean).join('\n\n')

  const LEAD_SYSTEM = `You are the Lead Editor. Rewrite the draft into its final form using your judgment on the notes below (not every note demands a literal fix, but take them seriously) - preserve the core story, keep it 35-45 words (tighter if it has dialogue - attribution and dramatic pauses read slower than plain narration), must read well spoken aloud in under 20 seconds. Real stories often include quoted dialogue ("cut back," he said) - that's good, keep it if it's there, just budget fewer words for it.

Also write a one-sentence, concrete, filmable visual description of the story's single key moment (who/what is on screen, setting, action) - this becomes an image-generation prompt, so it must not depend on any on-screen text, logo, or wordmark being legible.

Output in EXACTLY this format, nothing before or after, no markdown:
NARRATION: <the final narration text, quotes and all, unescaped>
VISUAL: <the one-sentence visual description>`

  // Real, live-caught bug, two failure modes back to back: first a
  // max_tokens truncation, then (after fixing that) a genuine JSON
  // escaping failure - the model didn't escape a quote inside quoted
  // dialogue correctly ("Marcus told his cardiologist he'd \"cut back\"...").
  // Real stories are supposed to have quoted dialogue like this, so
  // relying on the model to self-escape it into valid JSON is fragile by
  // nature - switched to a plain-text delimiter format instead of JSON for
  // this specific 2-field output, which sidesteps the whole failure class.
  const raw = await callClaude(`Draft:\n\n${draft}\n\nEditorial notes:\n\n${notesText}\n\nRewrite the final version now.`, LEAD_SYSTEM, 1200)
  const narrationMatch = raw.match(/NARRATION:\s*([\s\S]*?)\s*VISUAL:/i)
  const visualMatch = raw.match(/VISUAL:\s*([\s\S]*)/i)
  const final = { narration: narrationMatch?.[1]?.trim(), visual: visualMatch?.[1]?.trim() }
  if (!final.narration || !final.visual) throw new Error('Lead edit returned an incomplete result')

  // Real debugging need, live-caught: every intermediate Council step
  // (draft, refine, all 4 critiques) previously only existed as a
  // console.log during the request, gone the moment it scrolled past -
  // no way to see WHY a script came out the way it did after the fact.
  // Persisting the full trace alongside the final result (it rides along
  // wherever `script` already goes - stash, run schema - with no extra
  // plumbing needed) so it's always inspectable.
  final.trace = { styleTag: styleTag || null, claudeDraft, refinedDraft: draft, notes: { arbiter, realist, visionary, jester } }
  return final
}

// Real, deliberate simplification requested live 2026-07-26, after the
// full 6-call Council above: two calls instead of six, so it's fast
// enough to actually A/B different "writer room" configs in the
// Playground rather than waiting on a 4-voice critique every time. A
// single writer (Gemini or Grok, picked per test) pitches the whole
// story - own tone, own irony, no committee - and Claude's only job is
// editing/finalizing + the scenery (visual) line, never touching the
// writer's actual voice/jokes. This is a genuinely different pipeline
// shape from writeAdStory above (which stays untouched, still what the
// real funnel uses) - not a replacement, a second option to compare.
export const TONE_PRESETS = ['professional', 'funny', 'cinematic', 'zen']

const TONE_HINTS = {
  // professional: no hint - the base WRITE_SYSTEM's sincere/grounded voice
  // already is that default.
  funny: `This ad must be genuinely funny - real structural irony, not a pun. Silently identify the most cliche, expected way to frame this business, then write the story that sincerely and completely deadpan contradicts it - the friction between the two IS the joke. Never explain the joke, never use an exclamation point, never wrap it up with a neat bow or a punchline flourish - let the gap between expectation and reality do the work. The audience has to cross it themselves.`,
  cinematic: `Elevated, cinematic tone - treat this like a premium brand film, not a fast-cut ad. Confident, atmospheric, a little slower and more mood-driven. Understated, never jokey.`,
  zen: `Minimal, calm, sensory - closer to ASMR than a sales pitch. Favor stillness, texture, and one specific quiet sensory detail over plot events. Sparse - let silence and space carry weight rather than incident.`,
}

const WRITERS = {
  gemini: (prompt, system) => callGemini(prompt, system, process.env.GEMINI_API_KEY),
  grok: (prompt, system) => callGrok(prompt, system, process.env.XAI_API_KEY),
}

const SCENERY_SYSTEM = `You are the editor. Take the writer's draft below and finalize it - preserve their actual story, voice, and (if present) their joke or irony exactly as they built it; don't soften, explain, or flatten it. Tighten prose only where it genuinely helps, keep it 35-45 words (fewer if it has dialogue - attribution and dramatic pauses read slower than plain narration), must read well spoken aloud in under 20 seconds.

Also write a one-sentence, concrete, filmable visual description (the scenery) of the story's single key moment (who/what is on screen, setting, action) - this becomes an image-generation prompt, so it must not depend on any on-screen text, logo, or wordmark being legible.

Output in EXACTLY this format, nothing before or after, no markdown:
NARRATION: <the final narration text, quotes and all, unescaped>
VISUAL: <the one-sentence visual description>`

export async function writeAdStoryFast(brief, { tone = 'professional', writer = 'gemini' } = {}) {
  const toneHint = TONE_HINTS[tone] || ''
  const writeFn = WRITERS[writer] || WRITERS.gemini
  const draftBrief = `${briefText(brief)}\n\nWrite a short (35-45 word, fewer if it includes dialogue) real short story - not ad copy - with a beginning, middle, and end, that doubles as ad narration for this business. One clear throughline: pick ONE customer/character and follow them through one real moment (want/need -> they get it -> the payoff). End with a natural, ungimmicky mention of the business - it should feel like part of the story's own world, not a tacked-on slogan.${toneHint ? ` ${toneHint}` : ''}`

  const pitch = await writeFn(draftBrief, WRITE_SYSTEM)
  const raw = await callClaude(`Writer's draft:\n\n${pitch}\n\nEdit and finalize now.`, SCENERY_SYSTEM, 1200)

  const narrationMatch = raw.match(/NARRATION:\s*([\s\S]*?)\s*VISUAL:/i)
  const visualMatch = raw.match(/VISUAL:\s*([\s\S]*)/i)
  const final = { narration: narrationMatch?.[1]?.trim(), visual: visualMatch?.[1]?.trim() }
  if (!final.narration || !final.visual) throw new Error('Editor returned an incomplete result')

  final.trace = { mode: 'fast', tone, writer, pitch }
  return final
}
