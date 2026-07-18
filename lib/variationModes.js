// How closely a generation should stick to the reference photo. Read by
// IntakeSection (the slider UI + persistence + which cached description
// variant is showing) and GenerateVariations (maps to Recraft's strength
// dial and which of Flux's reference-conditioned prompt wrappers applies
// — see lib/engines/flux.js's referenceConditionedPrompt). 3 positions,
// matching lib/vision.js's buildVariants() exactly — [exact, similar,
// category] — real distinct constructions, not graduated prose levels.
export const VARIATION_LABELS = ['Exact', 'Similar', 'Category']
// Exact — index 0 — is what's auto-filled into Description on analysis
// (a single description, no picking needed); Similar/Category each need
// an explicit pick from 3 options, so Exact is the sensible default.
export const VARIATION_DEFAULT_INDEX = 0

const RECRAFT_STRENGTH = [0.15, 0.5, 0.85]
export function strengthForIndex(index) {
  return RECRAFT_STRENGTH[Math.max(0, Math.min(2, index))] ?? 0.5
}

const FLUX_MODES = ['exact', 'similar', 'category']
export function fluxModeForIndex(index) {
  return FLUX_MODES[Math.max(0, Math.min(2, index))] ?? 'similar'
}
