// MiniMax Hailuo image-to-video wrapper - same submit-then-poll shape as
// kling-video.js, so it can be swapped in as an alternate rendererHint
// without touching the queue/publish plumbing.
//
// Real differences from Kling worth keeping in mind:
//   - Camera motion is a named command INSIDE the prompt text (e.g. "[Push
//     in], the ancient hemlock looms closer"), not a separate structured
//     field - 15 commands: Truck, Pan, Push, Pedestal, Tilt, Zoom, Shake,
//     Tracking shot, Static shot (+ left/right/up/down variants). More
//     explicit than Kling's plain-English camera description, still just
//     text the model interprets.
//   - duration is 6 or 10s depending on model/resolution combo - "10"
//     matches what Rescript already standardizes on.
//   - resolution is a real separate field (512P/720P/768P/1080P depending
//     on model) instead of Kling's std/pro/4k quality tiers.
//   - Retrieval is two calls, not one: submit -> poll for status:"Success"
//     -> the poll response only gives a file_id, a SEPARATE call to
//     /v1/files/retrieve?file_id=... returns metadata with a real
//     download_url to fetch. (Real bug found live: /v1/files/retrieve_content
//     looks like the obvious "get the bytes" endpoint by name, but it 400s
//     with "invalid file purpose" for video files - it's for a different
//     file purpose, not video_generation output. /v1/files/retrieve is the
//     correct one.) Kling's poll response hands back a ready-to-fetch URL
//     directly, no second call needed.
const BASE_URL = 'https://api.minimax.io'

export async function submitImageToVideo({ imageBase64, prompt, apiKey, duration = '10', model = 'MiniMax-Hailuo-02', resolution }) {
  const body = {
    model,
    prompt,
    first_frame_image: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
    duration: Number(duration),
  }
  if (resolution) body.resolution = resolution
  const res = await fetch(`${BASE_URL}/v1/video_generation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || data.base_resp?.status_code !== 0) {
    throw new Error(`Hailuo submit failed: ${data.base_resp?.status_msg || res.status}`)
  }
  return data.task_id
}

export async function pollUntilDone(taskId, apiKey, { intervalMs = 15000, maxAttempts = 40 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${BASE_URL}/v1/query/video_generation?task_id=${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const data = await res.json()
    if (data.status === 'Success') return { fileId: data.file_id }
    if (data.status === 'Fail') throw new Error(`Hailuo task ${taskId} failed: ${data.base_resp?.status_msg || 'unknown'}`)
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`Hailuo task ${taskId} did not finish after ${maxAttempts} polls`)
}

export async function downloadFile(fileId, apiKey) {
  const metaRes = await fetch(`${BASE_URL}/v1/files/retrieve?file_id=${fileId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const meta = await metaRes.json()
  if (!metaRes.ok || meta.base_resp?.status_code !== 0) {
    throw new Error(`Hailuo file retrieve failed: ${meta.base_resp?.status_msg || metaRes.status}`)
  }
  const fileRes = await fetch(meta.file.download_url)
  if (!fileRes.ok) throw new Error(`Hailuo file download failed: ${fileRes.status}`)
  return Buffer.from(await fileRes.arrayBuffer())
}
