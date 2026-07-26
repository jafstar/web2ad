import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readSchema, mediaPaths } from './shots.js'
import { synthesizeSpeech } from './elevenlabs-tts.js'
import { generateMusic } from './music.js'
import { musicFilePath } from './musicEditor.js'
import { FFMPEG_PATH, FFPROBE_PATH } from './ffmpegBin.js'

const execFileAsync = promisify(execFile)
const RUNS_DIR = path.join(process.cwd(), '.adbuilder-runs')
function exportDir(runId) { return path.join(RUNS_DIR, runId, 'export') }
function schemaPath(runId) { return path.join(RUNS_DIR, runId, 'schema.json') }
function writeSchema(runId, schema) { fs.writeFileSync(schemaPath(runId), JSON.stringify(schema, null, 2)) }

// Same voice as the free preview - one continuous read, not per-shot.
const NARRATION_VOICE_ID = 'nPczCjzI2devNBz1zQrb'

// Real per-clip durations, not schema.durationSeconds - Hailuo's own
// duration clamp (see generateMotionFor in shots.js) always produces 6s
// clips regardless of what was requested, so trusting the schema field
// here would drift from the actual render length.
async function clipDuration(filePath) {
  const { stdout } = await execFileAsync(FFPROBE_PATH, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath])
  return parseFloat(stdout.trim()) || 4
}

// The real terminal step of the paid "finish" tier - nothing before this
// (ShotReview/MusicEditor) actually produces the ad itself, they only
// generate/patch individual pieces. This concatenates every enabled,
// finished shot in order, reads the narration once over the top, and
// mixes in the chosen (or a freshly generated) music bed underneath.
export async function exportFinalAd(runId) {
  const schema = readSchema(runId)
  const shots = schema.shots.filter((s) => !s.disabled && s.status === 'done').sort((a, b) => a.id - b.id)
  if (!shots.length) throw new Error('No finished shots to export yet')

  const dir = exportDir(runId)
  fs.mkdirSync(dir, { recursive: true })

  const clipPaths = shots.map((s) => mediaPaths(runId, s.id).render)
  const durations = await Promise.all(clipPaths.map(clipDuration))
  const totalDuration = durations.reduce((a, b) => a + b, 0)

  console.log('[adbuilder] Generating narration for export...')
  const apiKey = process.env.ELEVEN_LABS_API_KEY
  if (!apiKey) throw new Error('ELEVEN_LABS_API_KEY not configured')
  const narrationBuf = await synthesizeSpeech({ text: schema.script.narration, apiKey, voiceId: NARRATION_VOICE_ID })
  const narrationPath = path.join(dir, 'narration.mp3')
  fs.writeFileSync(narrationPath, narrationBuf)

  // Real, live-caught bug: narration with real quoted dialogue reads
  // slower than a flat line of the same word count (attribution pauses,
  // dramatic beats) - a 60-word story with two dialogue exchanges came in
  // at 25.2s of real speech against only 23.5s of video (4 shots x 5.875s
  // each), and the old hard `-t totalDuration` cap chopped the last ~1.7s
  // of narration off mid-sentence. Never trust the word-count estimate to
  // hold - measure the real synthesized audio and let the output be as
  // long as whichever is actually longer.
  const narrationDuration = await clipDuration(narrationPath)

  // If narration runs longer than the real video, freeze the last frame
  // to cover the gap instead of ending the video early while narration
  // keeps playing over nothing (or, with the old code, getting cut off).
  const finalDuration = Math.max(totalDuration, narrationDuration) + 0.3
  const videoPadding = Math.max(finalDuration - totalDuration, 0)

  console.log('[adbuilder] Preparing music for export...')
  let musicPath, musicCleanupDir = null
  if (schema.chosenMusic) {
    musicPath = musicFilePath(runId, schema.chosenMusic)
  } else {
    const music = await generateMusic(schema.brief, Math.ceil(finalDuration) + 2)
    musicPath = music.path
    musicCleanupDir = music.tmpDir
  }

  console.log('[adbuilder] Compositing final ad...')
  const outPath = path.join(dir, 'final.mp4')

  // Real production bug, narrowed down through several rounds of live
  // production retesting: ffmpeg-static's LINUX binary corrupts any filter
  // with 3+ colon-options (confirmed for zoompan and afade) whenever it
  // reads its input from an intermediate generated label instead of a raw
  // stream specifier - it truncates right after that filter's 2nd option
  // and drops everything up to the next recognizable token. The one filter
  // that survived intact in every single attempt was the one reading
  // directly from a raw stream rather than a prior stage's output label.
  // afade here now reads straight from the raw [idx:a] stream, with volume
  // (a single-option filter, never seen to fail) applied afterward on its
  // output instead of before. concat/tpad are left as direct multi-input
  // structurally (concat inherently needs each clip's own processed
  // stream) - not yet proven affected by this bug, unlike zoompan/afade;
  // revisit here first if export still fails after this change. See
  // preview.js's renderPreview for the fuller writeup; never seen locally
  // since dev used the Windows ffmpeg-static build, which doesn't have
  // this bug.
  const scaleChains = clipPaths.map((_, i) => `[${i}:v]scale=1024:1024[vs${i}];[vs${i}]setsar=1[v${i}]`).join(';')
  const concatInputs = clipPaths.map((_, i) => `[v${i}]`).join('')
  const narrationIdx = clipPaths.length
  const musicIdx = clipPaths.length + 1
  const fadeStart = Math.max(finalDuration - 1, 0)
  const musicFadeStart = fadeStart
  const narrFadeStart = Math.max(fadeStart - 0.05, 0)
  const filterComplex = `${scaleChains};${concatInputs}concat=n=${clipPaths.length}:v=1:a=0[vc];` +
    `[vc]tpad=stop_mode=clone:stop_duration=${videoPadding}[v];` +
    `[${musicIdx}:a]afade=t=out:st=${musicFadeStart}:d=1[af0];` +
    `[af0]volume=0.3[music];` +
    `[${narrationIdx}:a]afade=t=out:st=${narrFadeStart}:d=1.05[narr];` +
    `[narr][music]amix=inputs=2:duration=longest:dropout_transition=0[a]`

  const filterComplexPath = path.join(dir, 'filter_complex.txt')
  fs.writeFileSync(filterComplexPath, filterComplex)

  const args = ['-y']
  for (const p of clipPaths) args.push('-i', p)
  args.push('-i', narrationPath, '-i', musicPath)
  args.push(
    '-filter_complex_script', filterComplexPath,
    '-map', '[v]', '-map', '[a]',
    '-t', String(finalDuration),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
    outPath,
    '-loglevel', 'error',
  )
  await execFileAsync(FFMPEG_PATH, args)

  if (musicCleanupDir) { try { fs.rmSync(musicCleanupDir, { recursive: true, force: true }) } catch {} }

  schema.export = { readyAt: Date.now(), shotCount: shots.length, durationSeconds: finalDuration }
  writeSchema(runId, schema)

  return { durationSeconds: finalDuration, shotCount: shots.length }
}

export function exportFilePath(runId) {
  return path.join(exportDir(runId), 'final.mp4')
}
