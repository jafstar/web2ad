// ElevenLabs text-to-speech - real voice-quality upgrade over MiniMax's
// TTS specifically because sync.so's lip-sync pass needs a clean,
// high-fidelity voice track to sync mouth movement to; MiniMax TTS still
// exists as the cheap/no-lip-sync fallback (audioSync.js).
const BASE_URL = 'https://api.elevenlabs.io'

export async function listVoices(apiKey) {
  const res = await fetch(`${BASE_URL}/v2/voices?page_size=100`, {
    headers: { 'xi-api-key': apiKey },
  })
  if (!res.ok) throw new Error(`ElevenLabs list voices failed: ${res.status}`)
  const data = await res.json()
  return data.voices
}

export async function synthesizeSpeech({ text, apiKey, voiceId, modelId = 'eleven_multilingual_v2' }) {
  const res = await fetch(`${BASE_URL}/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: modelId }),
  })
  if (!res.ok) throw new Error(`ElevenLabs TTS failed: ${res.status} ${(await res.text()).slice(0, 300)}`)
  return Buffer.from(await res.arrayBuffer())
}
