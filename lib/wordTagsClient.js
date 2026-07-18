'use client'

import nlp from 'compromise'

// Real perf fix: word-tagging was a Gemini round trip, which was
// noticeably slow live even after parallelizing it with the Similar/
// Category call server-side (see lib/vision.js's git history). Part-of-
// speech tagging doesn't need an LLM at all — compromise is a real,
// fast, client-side (no network) NLP tagger built for exactly this.
// Priority (Focus/Detail) isn't a standard NLP category, so it's a
// simple deterministic rule on top of the POS tag: nouns are the actual
// subject matter of an image (Focus), verbs/adjectives describe or
// modify that subject (Detail) — not a semantic judgment call, just POS.
const SKIP_TAGS = new Set(['Determiner', 'Preposition', 'Conjunction', 'Pronoun', 'Value', 'Currency'])

export function tagWordsClient(text) {
  if (!text?.trim()) return []
  const terms = nlp(text).terms().json({ terms: { tags: true } })
  const result = []
  for (const item of terms) {
    const term = item.terms?.[0]
    const word = (term?.text || item.text || '').replace(/^[.,;:!?"'()]+|[.,;:!?"'()]+$/g, '').trim()
    if (!word) continue
    const tags = term?.tags || []
    if (tags.some((t) => SKIP_TAGS.has(t))) continue

    let pos = null
    if (tags.includes('Verb')) pos = 'verb'
    else if (tags.includes('Adjective')) pos = 'adjective'
    else if (tags.includes('Noun')) pos = 'noun'
    if (!pos) continue // skip adverbs and anything compromise couldn't classify

    result.push({ text: word, pos, priority: pos === 'noun' ? 'focus' : 'detail' })
  }
  return result
}
