// Ported verbatim from designpipe-app/renderer/lib/engines.js.
const ENGINE_TO_PROVIDER = { flux: 'bfl', recraft: 'recraft', gemini: 'gemini' }
const ENGINE_TO_LABEL = { flux: 'Flux', recraft: 'Recraft', gemini: 'Gemini' }

export function engineToProvider(engine) {
  return ENGINE_TO_PROVIDER[engine] ?? 'bfl'
}

export function engineToLabel(engine) {
  return ENGINE_TO_LABEL[engine] ?? 'Flux'
}
