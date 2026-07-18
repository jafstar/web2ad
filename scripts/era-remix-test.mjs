// Third Fx-mechanism proof, same night: instead of locking a character
// design and sweeping scene, this sweeps ERA - reimagine a public-domain
// character/setting in a different decade, entirely original visual
// design (not referencing any studio's copyrighted depiction), then hold
// THAT redesigned identity consistent across a couple of scenes. Tests
// whether the lock survives when the character's own look has to shift
// with the era, not just the backdrop around them.
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

const OUT_DIR = 'C:/DEV2/SYNCAGENT/syncagent-v2/syncagent-v2/mailbox/artifacts/gen-stock/era-remix-test'
fs.mkdirSync(OUT_DIR, { recursive: true })

const BOOKS = [
  {
    key: 'sherlock-70s',
    character: 'a sharp original detective character reimagined in 1970s style - thick sideburns, a wide-collared patterned shirt under a brown leather jacket, aviator sunglasses pushed up on his head, holding a vintage pipe, confident smirk, retro illustrated style with warm grainy film-like color grading',
    scenes: [
      { key: '1-crime-scene', desc: 'examining a clue at a moody 1970s crime scene, an old rotary phone and shag carpet in the background, dim amber lighting' },
      { key: '2-foggy-street', desc: 'walking through a foggy 1970s city street at night, vintage cars parked along the curb, neon signs glowing in the distance' },
    ],
  },
  {
    key: 'alice-90s',
    character: 'a curious original young-girl character reimagined in 1990s style - a plaid flannel shirt tied around her waist over a graphic tee, denim overalls, hair in two space buns, holding a chunky handheld game console, playful confident expression, bold saturated retro 90s illustrated poster style',
    scenes: [
      { key: '1-tunnel-fall', desc: 'falling through a swirling neon tunnel filled with floating cassette tapes, boomboxes, and old TVs, arms reaching out in excitement' },
      { key: '2-alley-hangout', desc: 'sitting cross-legged at a table covered in colorful soda cans and mismatched mugs in a graffiti-covered alley, string lights glowing overhead' },
    ],
  },
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

const results = []

for (const book of BOOKS) {
  console.log(`\n=== ${book.key} ===`)
  console.log('Generating reference character (Gemini)...')
  const refDataUrl = await generateGemini(`${book.character}, standing portrait, plain neutral background, front-facing`)
  const refFilename = saveImage(refDataUrl, `${book.key}-0-reference`)
  console.log(`  -> ${refFilename}`)
  results.push({ book: book.key, scene: '0-reference', filename: refFilename })

  for (const scene of book.scenes) {
    console.log(`${scene.key}...`)
    const dataUrl = await withRetries(
      () => generateFlux(scene.desc, 640, 480, refDataUrl, 'exact'),
      `${book.key}/${scene.key}`
    )
    const filename = saveImage(dataUrl, `${book.key}-${scene.key}`)
    console.log(`  -> ${filename}`)
    results.push({ book: book.key, scene: scene.key, filename })
  }
}

fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({ books: BOOKS, results }, null, 2))
console.log(`\nDone. ${results.length} images written to ${OUT_DIR}`)
