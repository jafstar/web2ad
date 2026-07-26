import fs from 'fs'
import path from 'path'
import { callClaude } from './claude.js'
import { generateFlux } from '../engines/flux.js'
import { submitImageToVideo, pollUntilDone, downloadFile } from './hailuo-video.js'
import { generateSeedanceVideo } from './models/seedance.js'
import { NO_TEXT_SUFFIX } from '../promptGuards.js'

// Real adaptation of rescript-studio's proven shot-review pattern (see
// rescript-studio-server.mjs) for web2ad's own multi-tenant, hosted
// context: that tool is a local, single-book, single-user GUI (one
// hardcoded BOOK_FOLDER, local SQLite action queue, spawns local CLI
// scripts as child processes). Here, every run gets its own id and JSON
// schema file so multiple users' ads don't collide, and actions call
// the generation functions directly in-process rather than staging a
// queue + spawning child processes - the queue existed to work around
// Kling's specific concurrency limit, which isn't our bottleneck yet.
const RUNS_DIR = path.join(process.cwd(), '.adbuilder-runs')

function runDir(runId) { return path.join(RUNS_DIR, runId) }
function schemaPath(runId) { return path.join(runDir(runId), 'schema.json') }
function keyframesDir(runId) { return path.join(runDir(runId), 'keyframes') }
function renderDirFor(runId) { return path.join(runDir(runId), 'render') }

export function readSchema(runId) {
  return JSON.parse(fs.readFileSync(schemaPath(runId), 'utf8'))
}

function writeSchema(runId, schema) {
  fs.writeFileSync(schemaPath(runId), JSON.stringify(schema, null, 2))
}

// Real configurable dimensions, requested live 2026-07-25 after finding
// (a) generateFlux already supports reference-chaining but nothing here
// used it, and (b) the account is hard-capped at Hailuo's 6s tier. Rather
// than silently picking one answer, these are real user-facing tradeoffs:
//   clipDuration: 6 | 10 (Hailuo, this account only actually fulfills 6 -
//     10 is real but will surface an honest per-shot error until the plan
//     changes) | 30 (Seedance via fal.ai - real native multi-beat
//     continuity, ~$3.33/video vs Hailuo's ~$1-2/full-ad, a premium tier
//     a customer opts into, not a silent upgrade)
//   framing: 'people' | 'balanced' | 'objects' - AI video is weakest at
//     faces/hands/anatomy; 'objects' biases the breakdown toward hands-
//     only/object-centric shots to sidestep that, 'people' allows full
//     character shots freely, 'balanced' is today's existing behavior
//   continuity: false (parallel, today's default, fast) | true
//     (sequential, each shot's keyframe uses the PREVIOUS shot's keyframe
//     as a real Flux reference image for actual visual continuity - only
//     possible sequentially since shot N+1 needs shot N's real output)
export const DEFAULT_OPTIONS = { maxScenes: 4, framing: 'balanced', clipDuration: 6, continuity: false }

function breakdownSystem({ maxScenes, framing, clipDuration }) {
  const durationNote = {
    6: 'the video engine only produces 6-second clips per shot on this account\'s plan - there is no shorter (or longer) option here. Fixating on one shot for more than ~5 seconds reads as stale in a commercial anyway, so this fits.',
    10: 'the video engine produces 10-second clips per shot - real, but noticeably longer per shot than the usual quick-cut commercial pace, so don\'t pad a shot just to fill the time.',
    30: 'the video engine (Seedance) can hold a single continuous 30-second shot with its own native multi-beat consistency - it can handle transitions WITHIN one shot description (e.g. "she walks to the counter, then turns to the camera, then smiles") without needing separate shots for each beat. Prefer FEWER, richer multi-beat scene descriptions over many short ones.',
  }[clipDuration] || ''

  const framingClause = {
    people: 'This ad may freely center on a visible human protagonist\'s face when it serves the story - full character shots are allowed.',
    objects: `Real production constraint: AI video generation is weakest at faces/hands/anatomy - it often produces uncanny or inconsistent results. Bias every shot toward hands-only, object-centric, or silhouette framing wherever the story beat allows it (a hand pouring, an object being used, a close-up on a detail, a product itself as the subject) rather than a full visible face. Only show a full face when the beat genuinely cannot work without one.`,
    balanced: 'Prefer showing a real person when the story beat calls for it, but don\'t force a full face into a shot that would work just as well hands-only or object-focused.',
  }[framing] || ''

  return `You break a real business ad brief into a short shot-by-shot video breakdown - ${maxScenes} shots or fewer, each a concrete, filmable scene (not an abstract concept). Each shot needs a one-sentence scene description specific enough to generate an image from (who/what is on screen, setting, action).

Real production constraint: ${durationNote}

${framingClause}

Also write a single "atmosphere" string, shared across every shot: lock the time of day, lighting, and weather/mood ONCE for the whole sequence (e.g. "late golden-hour sun, warm long shadows, clear sky"). Every shot will be generated separately, so without this shared lock each one tends to invent its own unrelated lighting/mood and the sequence doesn't read as one continuous moment.

Real, live-caught problem: shots that each introduce a DIFFERENT unconnected person (shot 1 a chef's hands, shot 2 some other customer, shot 3 different staff, shot 4 yet another customer) read as a generic stock-footage montage, not one ad telling one story - each shot gets generated independently with no shared reference image, so there is no automatic face continuity between them, which makes an unconnected cast especially incoherent. The narration below is a real short story with one specific character and a real beginning/middle/end (see lib/adbuilder/story.js's Council pass) - break THAT exact story into its own shot-by-shot sequence, in the same order, following its actual character and scene beats. Do not invent a different scenario, a different character, or a moment the story doesn't contain. If the same character appears in more than one shot, describe them consistently (same rough appearance/clothing) so the description itself carries continuity even though the image generator can't guarantee identical faces across separate calls.

The image generator cannot render legible text, words, or logos - it reliably garbles them. No shot's description may depend on on-screen text, UI, a screen recording, a sign, a label, or a brand wordmark being readable to make sense. Describe real people, objects, actions, and settings instead. Never assume a logo exists or describe one - only a real supplied logo image could ever appear, and none is given here. Do not quote the story's dialogue verbatim inside a shot description either - describe the moment visually instead (who's speaking, their expression/action), since dialogue can't be seen in a still image anyway.

Output in EXACTLY this format, nothing before or after, no markdown, one shot per line:
ATMOSPHERE: <the shared atmosphere sentence>
SHOT: <shot 1 scene description>
SHOT: <shot 2 scene description>
(up to ${maxScenes} SHOT lines total - don't include a duration, every shot uses the same fixed length)`
}

export async function generateShotBreakdown(brief, script, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const prompt = `Business: ${brief.businessName}\nWhat they do: ${brief.whatTheyDo}\nTone: ${brief.tone}\nThe real story/narration to break into shots:\n"${script.narration}"\nKey visual moment already identified: ${script.visual}`
  // Real, live-caught bug, twice: JSON output kept breaking whenever a
  // shot description echoed the story's quoted dialogue, even after
  // adding an explicit escaping instruction - that mitigation wasn't
  // reliable enough. Switched to a delimiter-line format, which sidesteps
  // JSON escaping entirely instead of continuing to patch the prompt and hope.
  const raw = await callClaude(prompt, breakdownSystem({ maxScenes: opts.maxScenes, clipDuration: opts.clipDuration, framing: opts.framing }), 1200)
  const atmosphere = raw.match(/ATMOSPHERE:\s*(.+)/i)?.[1]?.trim() || ''
  const shots = [...raw.matchAll(/^SHOT:\s*(.+)$/gim)]
    .slice(0, opts.maxScenes)
    .map((m) => ({ sceneDescription: m[1].trim(), durationSeconds: opts.clipDuration }))
  if (!shots.length) throw new Error('Shot breakdown returned no shots')
  return { shots, atmosphere }
}

async function generateKeyframeFor(runId, shotId, sceneDescription, brief, atmosphere, fixNote = '', referenceImageDataUrl = null) {
  const atmosphereClause = atmosphere ? ` Shared atmosphere for this whole ad, must match every other shot: ${atmosphere}.` : ''
  const prompt = fixNote
    ? `${sceneDescription}. Real, grounded, photographic - not stock-photo generic. For a business that does: ${brief.whatTheyDo}.${atmosphereClause} Fix: ${fixNote}${NO_TEXT_SUFFIX}`
    : `${sceneDescription}. Real, grounded, photographic - not stock-photo generic. For a business that does: ${brief.whatTheyDo}.${atmosphereClause}${NO_TEXT_SUFFIX}`
  // 'similar' mode: real creative reinterpretation (new composition/action)
  // while keeping the same general subject recognizable - what continuity
  // mode wants (same character, different moment), not 'exact' (near-
  // identical recreation) or 'category' (loose inspiration only).
  const dataUrl = await generateFlux(prompt, 1024, 1024, referenceImageDataUrl, 'similar')
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/)
  fs.mkdirSync(keyframesDir(runId), { recursive: true })
  const filename = `shot-${shotId}.jpg`
  fs.writeFileSync(path.join(keyframesDir(runId), filename), Buffer.from(match[1], 'base64'))
  return { filename, dataUrl }
}

async function generateMotionFor(runId, shotId, imageDataUrl, sceneDescription, durationSeconds, fixNote = '') {
  const prompt = fixNote ? `${sceneDescription}. ${fixNote}` : sceneDescription
  fs.mkdirSync(renderDirFor(runId), { recursive: true })

  if (durationSeconds === 30) {
    const buf = await generateSeedanceVideo({ imageDataUrl, prompt, durationSeconds: 30 })
    fs.writeFileSync(path.join(renderDirFor(runId), `shot-${shotId}.mp4`), buf)
    return
  }

  const apiKey = process.env.MINI_MAX_API_KEY
  if (!apiKey) throw new Error('MINI_MAX_API_KEY not configured')
  const taskId = await submitImageToVideo({
    imageBase64: imageDataUrl, prompt, apiKey,
    // Real account limitation, not a code limitation: Hailuo supports 6 or
    // 10s in general, but this account's MiniMax plan only actually
    // fulfills 6 - requesting 10 here is a deliberate user choice now that
    // duration is configurable, so it's passed through honestly and will
    // surface a real per-shot error ("your current token plan not support
    // model...") if the account can't fulfill it, rather than silently
    // downgrading to 6 without telling anyone.
    duration: String(durationSeconds),
  })
  const { fileId } = await pollUntilDone(taskId, apiKey, { intervalMs: 8000, maxAttempts: 45 })
  const buf = await downloadFile(fileId, apiKey)
  fs.writeFileSync(path.join(renderDirFor(runId), `shot-${shotId}.mp4`), buf)
}

// Split in two so the route can respond as soon as the schema exists
// (seconds - one Claude call) instead of blocking the whole request on
// every shot's real Flux+Hailuo/Seedance generation (minutes). initializeRun
// does the fast part and returns immediately; runShotGeneration does the
// slow part and is fired without awaiting it, so ShotReview's existing 3s
// poll (already built for the fix-and-patch flow) picks up each shot the
// moment its status changes on disk - no separate progress UI needed,
// just not blocking the response on the part that was already pollable.
//
// Real caveat, not addressed tonight: this relies on the Node process
// staying alive after the response is sent, which holds for this app's
// current always-on dev/persistent-server context but would NOT hold on
// a request-scoped serverless platform (the function could be frozen or
// killed right after responding) - worth re-checking before a serverless
// production deploy.
export async function initializeRun(runId, brief, script, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const { shots: shotDrafts, atmosphere } = await generateShotBreakdown(brief, script, opts)
  fs.mkdirSync(runDir(runId), { recursive: true })

  const shots = shotDrafts.map((s, i) => ({
    id: i + 1,
    sceneDescription: s.sceneDescription,
    durationSeconds: opts.clipDuration,
    disabled: false,
    source: 'director',
    status: 'pending',
  }))
  const schema = { runId, brief, script, atmosphere, shots, options: opts, createdAt: Date.now() }
  writeSchema(runId, schema)
  return schema
}

export async function runShotGeneration(runId, brief) {
  const schema = readSchema(runId)
  const { atmosphere, shots } = schema
  const opts = { ...DEFAULT_OPTIONS, ...(schema.options || {}) }

  if (opts.continuity) {
    // Sequential: each shot's keyframe is generated using the PREVIOUS
    // shot's real keyframe as a Flux reference image, for actual visual
    // continuity - only possible sequentially, shot N+1 needs shot N's
    // real output to exist first. Real cost: total wall-clock time is now
    // roughly the SUM of every shot's generation time instead of the
    // slowest one, since they can no longer run in parallel.
    let referenceImageDataUrl = null
    for (const shot of shots) {
      try {
        const { dataUrl } = await generateKeyframeFor(runId, shot.id, shot.sceneDescription, brief, atmosphere, '', referenceImageDataUrl)
        updateShotStatus(runId, shot.id, 'keyframe-done')
        await generateMotionFor(runId, shot.id, dataUrl, shot.sceneDescription, shot.durationSeconds)
        updateShotStatus(runId, shot.id, 'done')
        referenceImageDataUrl = dataUrl
      } catch (e) {
        console.error(`[adbuilder] shot ${shot.id} failed:`, e.message)
        updateShotStatus(runId, shot.id, 'error', e.message)
        // Keep the last successful reference so one failed shot doesn't
        // break continuity for the rest of the chain.
      }
    }
  } else {
    await Promise.all(shots.map(async (shot) => {
      try {
        const { dataUrl } = await generateKeyframeFor(runId, shot.id, shot.sceneDescription, brief, atmosphere)
        updateShotStatus(runId, shot.id, 'keyframe-done')
        await generateMotionFor(runId, shot.id, dataUrl, shot.sceneDescription, shot.durationSeconds)
        updateShotStatus(runId, shot.id, 'done')
      } catch (e) {
        console.error(`[adbuilder] shot ${shot.id} failed:`, e.message)
        updateShotStatus(runId, shot.id, 'error', e.message)
      }
    }))
  }

  return readSchema(runId)
}

function updateShotStatus(runId, shotId, status, errorMessage = null) {
  const schema = readSchema(runId)
  const shot = schema.shots.find((s) => s.id === shotId)
  if (shot) { shot.status = status; if (errorMessage) shot.error = errorMessage; else delete shot.error }
  writeSchema(runId, schema)
}

// Finds the nearest earlier ENABLED, DONE shot's real keyframe, so a later
// patch/retry in continuity mode still chains off the real prior shot
// instead of silently reverting to independent (reference-less) generation.
function findPriorReferenceImage(schema, shotId) {
  if (!schema.options?.continuity) return null
  const priorDone = schema.shots
    .filter((s) => s.id < shotId && !s.disabled && s.status === 'done')
    .sort((a, b) => b.id - a.id)[0]
  if (!priorDone) return null
  const imgPath = path.join(keyframesDir(schema.runId), `shot-${priorDone.id}.jpg`)
  if (!fs.existsSync(imgPath)) return null
  return `data:image/jpeg;base64,${fs.readFileSync(imgPath).toString('base64')}`
}

export async function patchKeyframe(runId, shotId, fixNote) {
  const schema = readSchema(runId)
  const shot = schema.shots.find((s) => s.id === shotId)
  if (!shot) throw new Error('Shot not found')
  const referenceImageDataUrl = findPriorReferenceImage(schema, shotId)
  const { dataUrl } = await generateKeyframeFor(runId, shotId, shot.sceneDescription, schema.brief, schema.atmosphere, fixNote, referenceImageDataUrl)
  await generateMotionFor(runId, shotId, dataUrl, shot.sceneDescription, shot.durationSeconds, fixNote)
  updateShotStatus(runId, shotId, 'done')
  return readSchema(runId)
}

export async function patchMotion(runId, shotId, fixNote) {
  const schema = readSchema(runId)
  const shot = schema.shots.find((s) => s.id === shotId)
  if (!shot) throw new Error('Shot not found')
  const imgPath = path.join(keyframesDir(runId), `shot-${shotId}.jpg`)
  const imageDataUrl = `data:image/jpeg;base64,${fs.readFileSync(imgPath).toString('base64')}`
  await generateMotionFor(runId, shotId, imageDataUrl, shot.sceneDescription, shot.durationSeconds, fixNote)
  updateShotStatus(runId, shotId, 'done')
  return readSchema(runId)
}

export function toggleShot(runId, shotId) {
  const schema = readSchema(runId)
  const shot = schema.shots.find((s) => s.id === shotId)
  if (!shot) throw new Error('Shot not found')
  shot.disabled = !shot.disabled
  writeSchema(runId, schema)
  return schema
}

export function mediaPaths(runId, shotId) {
  return {
    keyframe: path.join(keyframesDir(runId), `shot-${shotId}.jpg`),
    render: path.join(renderDirFor(runId), `shot-${shotId}.mp4`),
  }
}
