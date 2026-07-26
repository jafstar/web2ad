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

  // Built via array + join rather than chained template-literal `+` - see
  // preview.js's renderPreview for why: Next's production minifier (SWC)
  // was found to incorrectly constant-fold a chained-`+` template literal
  // containing a module-level constant, silently dropping whole segments.
  // fadeStart/videoPadding here are runtime-computed (not statically
  // foldable) so this file likely was never actually affected, but the
  // safer pattern costs nothing.
  const scaleChains = clipPaths.map((_, i) => `[${i}:v]scale=1024:1024,setsar=1[v${i}]`).join(';')
  const concatInputs = clipPaths.map((_, i) => `[v${i}]`).join('')
  const narrationIdx = clipPaths.length
  const musicIdx = clipPaths.length + 1
  const fadeStart = Math.max(finalDuration - 1, 0)
  const filterComplex = [
    `${scaleChains};${concatInputs}concat=n=${clipPaths.length}:v=1:a=0[vc]`,
    `[vc]tpad=stop_mode=clone:stop_duration=${videoPadding}[v]`,
    `[${musicIdx}:a]volume=0.3,afade=t=out:st=${fadeStart}:d=1[music]`,
    `[${narrationIdx}:a]afade=t=out:st=${fadeStart}:d=1[narr]`,
    `[narr][music]amix=inputs=2:duration=longest:dropout_transition=0[a]`,
  ].join(';')

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
