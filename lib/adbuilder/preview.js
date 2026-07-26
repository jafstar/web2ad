import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { generateFlux } from '../engines/flux.js'
import { synthesizeSpeech } from './elevenlabs-tts.js'
import { generateMusic } from './music.js'
import { NO_TEXT_SUFFIX } from '../promptGuards.js'

const execFileAsync = promisify(execFile)

// Brian - same ElevenLabs voice used for the real Chapmans/SNAKZ ads
// tonight, proven to read clean and warm rather than "cheap TTS."
const NARRATION_VOICE_ID = 'nPczCjzI2devNBz1zQrb'
const PREVIEW_SECONDS = 5

// Real, deliberate cost/speed tradeoff for the free preview tier: one
// Flux still image with a simple ffmpeg Ken Burns pan/zoom, not a real
// Hailuo/Kling motion generation. Motion generation is slower and far
// more expensive per call - appropriate for the paid "finish" tier, not
// something to spend on every anonymous visitor's free 5s teaser.
export async function renderPreview({ brief, script }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adbuilder-preview-'))

  console.log('[adbuilder] Generating hero image...')
  const imageDataUrl = await generateFlux(
    `${script.visual}. Real, grounded, photographic - not stock-photo generic. For a business that does: ${brief.whatTheyDo}.${NO_TEXT_SUFFIX}`,
    1024, 1024
  )
  const imgMatch = imageDataUrl.match(/^data:image\/\w+;base64,(.+)$/)
  const imagePath = path.join(tmp, 'hero.jpg')
  fs.writeFileSync(imagePath, Buffer.from(imgMatch[1], 'base64'))

  console.log('[adbuilder] Generating narration...')
  const apiKey = process.env.ELEVEN_LABS_API_KEY
  if (!apiKey) throw new Error('ELEVEN_LABS_API_KEY not configured')
  const narrationBuf = await synthesizeSpeech({ text: script.narration, apiKey, voiceId: NARRATION_VOICE_ID })
  const narrationPath = path.join(tmp, 'narration.mp3')
  fs.writeFileSync(narrationPath, narrationBuf)

  console.log('[adbuilder] Generating music bed...')
  const music = await generateMusic(brief, PREVIEW_SECONDS + 2)

  console.log('[adbuilder] Compositing preview...')
  const outPath = path.join(tmp, 'preview.mp4')
  // Ken Burns: slow zoom-in over the still frame, narration + music
  // ducked under it (music quieter, narration full), both trimmed/faded
  // to exactly PREVIEW_SECONDS.
  await execFileAsync('ffmpeg', [
    '-y',
    '-loop', '1', '-i', imagePath,
    '-i', narrationPath,
    '-i', music.path,
    '-filter_complex',
    `[0:v]scale=1280:1280,zoompan=z='min(zoom+0.0015,1.15)':d=${PREVIEW_SECONDS * 25}:s=1280x1280:fps=25,scale=1024:1024,setsar=1[v];` +
    `[2:a]volume=0.35,afade=t=out:st=${PREVIEW_SECONDS - 0.6}:d=0.6[music];` +
    `[1:a]afade=t=out:st=${PREVIEW_SECONDS - 0.6}:d=0.6[narr];` +
    `[narr][music]amix=inputs=2:duration=first:dropout_transition=0[a]`,
    '-map', '[v]', '-map', '[a]',
    '-t', String(PREVIEW_SECONDS),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
    outPath,
    '-loglevel', 'error',
  ])

  const videoBuf = fs.readFileSync(outPath)
  const videoBase64 = `data:video/mp4;base64,${videoBuf.toString('base64')}`

  // Best-effort cleanup - don't fail the request over a temp-dir removal.
  try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}
  try { fs.rmSync(music.tmpDir, { recursive: true, force: true }) } catch {}

  return { videoDataUrl: videoBase64, imageDataUrl, musicPrompt: music.prompt }
}
