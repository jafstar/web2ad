// Second Fx-mechanism proof, same night as the walk-cycle test: instead
// of sweeping angle or pose, lock a character once and sweep SCENE - the
// actual ask for "illustrated editions of public-domain classics."
// Deliberately an original visual take (Victorian dark-haired girl in
// yellow, not the Disney blue-dress/blonde/headband design) inspired by
// the original 1865 Tenniel engravings rather than any studio's modern
// copyrighted redesign - the book is public domain, this illustration
// style is original. Flux only, per tonight's walk-cycle result.
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

const OUT_DIR = 'C:/DEV2/SYNCAGENT/syncagent-v2/syncagent-v2/mailbox/artifacts/gen-stock/illustrated-classic-test'
fs.mkdirSync(OUT_DIR, { recursive: true })

const CHARACTER = 'a young Victorian-era girl, shoulder-length dark brown hair with a simple ribbon, wearing a pale yellow pinafore dress with a white blouse, gentle curious expression, vintage storybook illustration style, soft watercolor texture, delicate ink linework, warm muted color palette'

const SCENES = [
  { key: '1-rabbit-hole', desc: 'falling slowly through a dark tunnel lined with floating clocks, bottles, and furniture drifting past, arms reaching out in wonder, soft glowing light from above' },
  { key: '2-tea-party', desc: 'seated at a long table set for tea in an overgrown garden, a giant teapot and mismatched cups scattered across the tablecloth, dappled sunlight through the trees' },
  { key: '3-tiny-door', desc: 'kneeling before a very small door set into a garden wall, peering through the keyhole at a bright garden glowing beyond it' },
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

console.log('Generating base reference character (Gemini)...')
const refDataUrl = await generateGemini(`${CHARACTER}, standing portrait, plain neutral background, front-facing`)
const refFilename = saveImage(refDataUrl, '0-reference-character')
console.log(`  -> ${refFilename}\n`)

const results = [{ scene: '0-reference', filename: refFilename }]

for (const scene of SCENES) {
  console.log(`${scene.key}...`)
  const dataUrl = await withRetries(
    () => generateFlux(scene.desc, 640, 480, refDataUrl, 'exact'),
    scene.key
  )
  const filename = saveImage(dataUrl, `flux-${scene.key}`)
  console.log(`  -> ${filename}`)
  results.push({ scene: scene.key, filename })
}

fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({ character: CHARACTER, scenes: SCENES, results }, null, 2))
console.log(`\nDone. ${results.length}/${SCENES.length + 1} images written to ${OUT_DIR}`)
