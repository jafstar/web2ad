// Real ByteDance Seedance 2.0 wrapper via fal.ai, ported from story-glue's
// proven test (scripts/test-seedance.mjs, real confirmed output against
// the Silkie chicken ref image). Seedance's real selling point - native
// multi-shot/long-duration consistency in one generation - is why it's
// the premium 30s tier here: ~$3.33/video vs Hailuo's ~$1-2/full-ad
// economics (see project_web2ad_architecture_thesis memory), a real
// cost/quality tradeoff a customer opts into, not a silent upgrade.
import { fal } from '@fal-ai/client'

let configured = false
function ensureConfigured() {
  if (configured) return
  const apiKey = process.env.FAL_API_KEY
  if (!apiKey) throw new Error('FAL_API_KEY not configured')
  fal.config({ credentials: apiKey })
  configured = true
}

export async function generateSeedanceVideo({ imageDataUrl, prompt, durationSeconds = 30 }) {
  ensureConfigured()
  const match = /^data:image\/\w+;base64,(.+)$/.exec(imageDataUrl)
  const buf = Buffer.from(match ? match[1] : imageDataUrl, 'base64')
  const imageUrl = await fal.storage.upload(new Blob([buf], { type: 'image/jpeg' }))

  const result = await fal.subscribe('bytedance/seedance-2.0/fast/image-to-video', {
    input: {
      prompt,
      image_url: imageUrl,
      resolution: '720p',
      duration: String(durationSeconds),
      generate_audio: false,
    },
    logs: false,
  })
  if (!result.data?.video?.url) throw new Error('Seedance returned no video')
  const videoRes = await fetch(result.data.video.url)
  if (!videoRes.ok) throw new Error(`Seedance video download failed: ${videoRes.status}`)
  return Buffer.from(await videoRes.arrayBuffer())
}
