// One-off: generates real landscape/sky photography for the hero
// console's tile content, replacing picsum.photos placeholders — using
// genstock's own Flux+Gemini pipeline (lib/engines/), the same real
// generation code the product itself runs. Prompts echo the mood from
// designpipe-app's now-corrupted "test1" project (golden-hour prairie,
// storm clouds, rural fence lines) since that's the only record left of
// what that data looked like, per the real screenshots shared tonight.
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
const { generateRecraft } = await import('../lib/engines/recraft.js')
const GENERATORS = { flux: (p) => generateFlux(p, 400, 400), gemini: generateGemini, recraft: generateRecraft }

const OUT_DIR = path.join(ROOT, 'public', 'hero')
fs.mkdirSync(OUT_DIR, { recursive: true })

// One set of 3 per mood chip, matching HeroConsole's existing CHIP_DATA
// structure (4 chips x 3 tiles) and genstock-hero.html's original exact
// FLUX/RECRAFT source pattern per chip (now that BFL_API_KEY is real).
const JOBS = [
  { chip: 'editorial', engine: 'flux', prompt: 'dramatic orange and red streaked sunset clouds over open prairie, high contrast editorial photography, dark storm clouds blending into fiery horizon glow' },
  { chip: 'editorial', engine: 'recraft', prompt: 'dark storm clouds blending into fiery horizon glow over flat rural pasture, dramatic directional lighting, bold shadows' },
  { chip: 'editorial', engine: 'flux', prompt: 'wooden rail fence bordering open grassy field under dramatic streaked sky, high contrast, magazine-quality composition' },

  { chip: 'studio', engine: 'recraft', prompt: 'flat rural pasture stretching to distant horizon line, clean bright daylight, sharp focus, commercial landscape photography' },
  { chip: 'studio', engine: 'flux', prompt: 'wide open prairie field with wooden fence, soft even daylight, crisp clean composition' },
  { chip: 'studio', engine: 'recraft', prompt: 'lone tree on flat grassland under clear sky, clean studio-quality lighting, sharp focus' },

  { chip: 'warm-film', engine: 'flux', prompt: 'golden hour prairie landscape, warm orange and amber tones, soft film grain, gentle sun flare over rolling grassland' },
  { chip: 'warm-film', engine: 'flux', prompt: 'sunset over rural fence line, warm golden light, nostalgic cinematic tones, shot on film' },
  { chip: 'warm-film', engine: 'recraft', prompt: 'dramatic orange and red sunset clouds over farmland, warm golden-hour glow, soft film grain' },

  { chip: 'minimal', engine: 'recraft', prompt: 'flat rural pasture stretching to distant horizon, bright natural light, generous negative space, minimal composition' },
  { chip: 'minimal', engine: 'flux', prompt: 'wide open grassy field under pale blue sky, clean minimal horizon line, soft airy tones' },
  { chip: 'minimal', engine: 'flux', prompt: 'single wooden fence post in open field, wide negative space, high-key soft lighting' },
]

async function runJob(job, index) {
  console.log(`[${index + 1}/${JOBS.length}] ${job.chip} (${job.engine})...`)
  const dataUrl = await GENERATORS[job.engine](job.prompt)
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
  const filename = `${job.chip}-${index}.${ext}`
  fs.writeFileSync(path.join(OUT_DIR, filename), Buffer.from(match[2], 'base64'))
  console.log(`  -> ${filename}`)
  return { chip: job.chip, filename, engine: job.engine.toUpperCase() }
}

// Small batches, not all 12 at once — same discipline as every other
// concurrent-call site tonight (avoid hammering rate limits).
const results = []
for (let i = 0; i < JOBS.length; i += 4) {
  const batch = JOBS.slice(i, i + 4)
  const settled = await Promise.allSettled(batch.map((job, j) => runJob(job, i + j)))
  for (const s of settled) {
    if (s.status === 'fulfilled') results.push(s.value)
    else console.error('  FAILED:', s.reason?.message)
  }
}

fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(results, null, 2))
console.log(`\nDone: ${results.length}/${JOBS.length} generated. Manifest written to public/hero/manifest.json`)
