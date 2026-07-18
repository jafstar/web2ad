// Real "orchestrator pattern" — per mailbox/artifacts/gen-stock/gemini-
// mood-prompts.md: the user picks a mood instead of writing technical
// photography language themselves. Labels match genstock-hero.html's
// already-designed console demo chips exactly — the marketing page
// promises these four, so the product has to actually offer these four.
export const MOOD_PRESETS = [
  { key: 'editorial', label: 'Editorial', prompt: 'high contrast, bold shadows, editorial photography style, dramatic directional lighting, magazine-quality composition' },
  { key: 'studio', label: 'Studio Light', prompt: 'clean studio lighting, seamless background, sharp focus, commercial product photography, soft even fill light' },
  { key: 'warm-film', label: 'Warm Film', prompt: 'warm golden-hour tones, soft film grain, gentle sun flare, nostalgic cinematic warmth, shot on 35mm' },
  { key: 'minimal', label: 'Minimal', prompt: 'bright natural light, soft airy tones, clean minimal composition, generous negative space, high-key lighting' },
]
