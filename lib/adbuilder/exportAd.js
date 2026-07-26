import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readSchema, writeSchema } from './shots.js'
import { synthesizeSpeech } from './elevenlabs-tts.js'
import { generateMusic } from './music.js'
import { downloadChosenMusic } from './musicEditor.js'
import { FFMPEG_PATH, FFPROBE_PATH } from './ffmpegBin.js'
import { uploadBufferToCloudinary } from '../cloudinary.js'

const execFileAsync = promisify(execFile)

// Same voice as the free preview - one continuous read, not per-shot.
const NARRATION_VOICE_ID = 'nPczCjzI2devNBz1zQrb'

async function downloadToFile(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`)
  fs.writeFileSync(destPath, Buffer.from(await res.arrayBuffer()))
}

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
//
// Real production bug fixed here: every input used to be a local file
// path already sitting under process.cwd()/.adbuilder-runs/<runId>/ -
// broken on Vercel the same way as shots.js (see its own comment for the
// full writeup). Shot renders and chosen music now live on Cloudinary
// (schema.shots[].renderUrl, schema.chosenMusic), so this downloads each
// one into a fresh local /tmp dir first - ffmpeg still needs real local
// files to composite, that part hasn't changed - then uploads the final
// result back to Cloudinary instead of leaving it on local disk.
export async function exportFinalAd(runId) {
  const schema = await readSchema(runId)
  const shots = schema.shots.filter((s) => !s.disabled && s.status === 'done').sort((a, b) => a.id - b.id)
  if (!shots.length) throw new Error('No finished shots to export yet')

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adbuilder-export-'))

  console.log('[adbuilder] Downloading shot renders for export...')
  const clipPaths = await Promise.all(shots.map(async (s, i) => {
    const p = path.join(dir, `clip-${i}.mp4`)
    await downloadToFile(s.renderUrl, p)
    return p
  }))
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
    musicPath = path.join(dir, 'music.mp3')
    await downloadChosenMusic(schema.chosenMusic, musicPath)
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

  console.log('[adbuilder] Uploading final export...')
  const { url: exportUrl } = await uploadBufferToCloudinary(fs.readFileSync(outPath), `adbuilder/${runId}/export`, 'video')

  if (musicCleanupDir) { try { fs.rmSync(musicCleanupDir, { recursive: true, force: true }) } catch {} }
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}

  schema.export = { url: exportUrl, readyAt: Date.now(), shotCount: shots.length, durationSeconds: finalDuration }
  await writeSchema(runId, schema)

  return { durationSeconds: finalDuration, shotCount: shots.length }
}
