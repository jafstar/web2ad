// Exploratory test, not a shipped feature — see
// mailbox/artifacts/gen-stock/new-types/genstock-2d-animation-gap.md.
// Question: can identity be held across a POSE axis (not just the angle
// axis Fx's 180 Deg already tests), and which engine holds it best?
//
// Plan: generate one reference character (Gemini, prompt-only), then run
// the same 3-pose sequence (idle / jump-peak / landing) through all three
// engines reference-conditioned against it — Flux via its existing
// 'exact' mode wrapper (built for exactly this: "keep everything, apply
// only this one change"), Recraft via imageToImage at low strength, and
// Gemini re-described from scratch each time (no reference-image concept
// at all, so this is also a real test of whether pure text consistency
// holds up without visual conditioning).
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dir = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dir, '..')

const envPath = path.join(ROOT, '.env.local')
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1')
}

const { generateFlux } = await import('../lib/engines/flux.js')
const { generateGemini } = await import('../lib/engines/gemini.js')
const { generateFromReference } = await import('../lib/engines/recraft.js')

// Real bug, live-caught: this used to be ROOT.replace('genstock-web', ...),
// assuming the mailbox lived under a shared ancestor of genstock-web's own
// path - it doesn't (genstock-web is under AI_BUILD_ZONE, the mailbox is
// under a completely separate SYNCAGENT tree), so results landed in a
// throwaway AI_BUILD_ZONE/mailbox that isn't where the project's real
// gen-stock artifacts live. Hardcoded to the real path instead.
const OUT_DIR = 'C:/DEV2/SYNCAGENT/syncagent-v2/syncagent-v2/mailbox/artifacts/gen-stock/2d-animation-test'
fs.mkdirSync(OUT_DIR, { recursive: true })

const CHARACTER = 'a small orange fox character, simple flat 2D cartoon style, big round eyes, clean black outline, solid pastel yellow background, front-facing'

const POSES = [
  { key: 'idle', desc: 'standing upright, arms at sides, neutral calm expression' },
  { key: 'jump-peak', desc: 'mid-air jumping, arms spread wide, legs tucked up, excited expression' },
  { key: 'landing', desc: 'crouched low just after landing, arms out for balance, determined expression' },
]

function saveImage(dataUrl, filename) {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
  const finalName = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`
  fs.writeFileSync(path.join(OUT_DIR, finalName), Buffer.from(match[2], 'base64'))
  return finalName
}

console.log('Generating base reference character (Gemini)...')
const refDataUrl = await generateGemini(`${CHARACTER}, ${POSES[0].desc}`)
const refFilename = saveImage(refDataUrl, 'reference-base')
console.log(`  -> ${refFilename}\n`)

const results = [{ engine: 'reference', pose: 'idle', filename: refFilename }]

async function runFlux(pose) {
  const dataUrl = await generateFlux(pose.desc, 480, 480, refDataUrl, 'exact')
  return saveImage(dataUrl, `flux-${pose.key}`)
}

async function runRecraft(pose) {
  const dataUrl = await generateFromReference({
    imageDataUrl: refDataUrl,
    prompt: `The exact same fox character, now in this pose: ${pose.desc}`,
    strength: 0.3,
    count: 1,
  })
  const item = Array.isArray(dataUrl) ? dataUrl[0] : dataUrl
  return saveImage(item.dataUrl ?? item, `recraft-${pose.key}`)
}

async function runGemini(pose) {
  const dataUrl = await generateGemini(`${CHARACTER}, ${pose.desc}`)
  return saveImage(dataUrl, `gemini-${pose.key}`)
}

const JOBS = []
for (const pose of POSES) {
  JOBS.push({ engine: 'flux', pose, run: () => runFlux(pose) })
  JOBS.push({ engine: 'recraft', pose, run: () => runRecraft(pose) })
  JOBS.push({ engine: 'gemini', pose, run: () => runGemini(pose) })
}

// Small batches, not all 9 at once - same rate-limit discipline as
// generate-hero-images.mjs.
for (let i = 0; i < JOBS.length; i += 3) {
  const batch = JOBS.slice(i, i + 3)
  console.log(`Batch ${i / 3 + 1}/${Math.ceil(JOBS.length / 3)}: ${batch.map((j) => `${j.engine}/${j.pose.key}`).join(', ')}...`)
  const settled = await Promise.allSettled(batch.map((j) => j.run()))
  settled.forEach((s, idx) => {
    const job = batch[idx]
    if (s.status === 'fulfilled') {
      console.log(`  ${job.engine}/${job.pose.key} -> ${s.value}`)
      results.push({ engine: job.engine, pose: job.pose.key, filename: s.value })
    } else {
      console.error(`  ${job.engine}/${job.pose.key} FAILED: ${s.reason?.message}`)
      results.push({ engine: job.engine, pose: job.pose.key, error: s.reason?.message })
    }
  })
}

fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({ character: CHARACTER, poses: POSES, results }, null, 2))
console.log(`\nDone. ${results.filter((r) => r.filename).length}/${JOBS.length + 1} images written to ${OUT_DIR}`)
