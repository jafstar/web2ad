// Follow-up to 2d-animation-test.mjs's 3-engine comparison: Flux was the
// clear quality winner (near-identical style/identity to the reference,
// genuinely different dynamic pose) but timed out on 2/3 calls in that
// run - a reliability problem, not a quality one. This test goes all-Flux
// with real retry logic instead, and asks for something harder: a full
// 6-frame walk cycle (the standard keyframe set - contact, down, passing,
// up, contact-mirror, passing-mirror), in side profile since that's how
// walk cycles actually read, not the front-facing angle the reference
// character was built in. Tests both identity-lock AND a simultaneous
// angle change, not just pose alone.
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

const OUT_DIR = 'C:/DEV2/SYNCAGENT/syncagent-v2/syncagent-v2/mailbox/artifacts/gen-stock/2d-animation-walk-test'
fs.mkdirSync(OUT_DIR, { recursive: true })

const CHARACTER = 'a small orange fox character, simple flat 2D cartoon style, big round eyes, clean black outline, solid pastel yellow background'

// Standard 6-frame walk cycle, side profile (facing right) throughout -
// walk cycles read by leg position, not front-on.
const FRAMES = [
  { key: '1-contact', desc: 'side view facing right, mid-walk: right leg stepped forward and planted, left leg trailing back bent at the knee, arms swinging naturally opposite the legs' },
  { key: '2-down', desc: 'side view facing right, mid-walk: body at its lowest point in the stride, both legs bent underneath, weight settling onto the forward leg' },
  { key: '3-passing', desc: 'side view facing right, mid-walk: legs crossing directly under the body, one knee lifted past the other, body at normal standing height' },
  { key: '4-up', desc: 'side view facing right, mid-walk: body at its highest point in the stride, legs extended apart, back leg pushing off the ground' },
  { key: '5-contact-mirror', desc: 'side view facing right, mid-walk: left leg now stepped forward and planted, right leg trailing back bent at the knee, arms swinging opposite - the mirror of the first step' },
  { key: '6-passing-mirror', desc: 'side view facing right, mid-walk: legs crossing under the body again, the other knee lifted this time, body at normal standing height, about to return to the first pose' },
]

function saveImage(dataUrl, filename) {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
  const finalName = `${filename}.${ext}`
  fs.writeFileSync(path.join(OUT_DIR, finalName), Buffer.from(match[2], 'base64'))
  return finalName
}

async function withRetries(fn, label, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      console.error(`  ${label} attempt ${i}/${attempts} failed: ${e.message}`)
      if (i === attempts) throw e
    }
  }
}

console.log('Generating base reference character (Gemini, front-facing)...')
const refDataUrl = await generateGemini(`${CHARACTER}, standing upright, arms at sides, neutral expression, front-facing`)
const refFilename = saveImage(refDataUrl, '0-reference-base')
console.log(`  -> ${refFilename}\n`)

const results = [{ frame: '0-reference', filename: refFilename }]

// Sequential, not concurrent - a full walk cycle needs to actually read
// as one continuous sequence when someone flips through the frames in
// order, and running 6 long-poll Flux calls at once risks exactly the
// timeout pile-up this retry logic exists to avoid.
for (const frame of FRAMES) {
  console.log(`${frame.key}...`)
  const dataUrl = await withRetries(
    () => generateFlux(frame.desc, 480, 480, refDataUrl, 'exact'),
    frame.key
  )
  const filename = saveImage(dataUrl, `flux-${frame.key}`)
  console.log(`  -> ${filename}`)
  results.push({ frame: frame.key, filename })
}

fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({ character: CHARACTER, frames: FRAMES, results }, null, 2))
console.log(`\nDone. ${results.length}/${FRAMES.length + 1} images written to ${OUT_DIR}`)
