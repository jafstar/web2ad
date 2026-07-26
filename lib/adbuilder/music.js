import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { searchReferenceTracks, downloadPreview } from './musicReferenceSearch.js'
import { analyzeReferenceTrack, buildPromptFromAnalysis } from './audioAnalysis.js'

const execFileAsync = promisify(execFile)

// Real ElevenLabs sound-generation, not MiniMax music-2.6 (used tonight
// in story-glue) - web2ad only has ELEVEN_LABS_API_KEY configured, and
// ElevenLabs' sound-generation endpoint covers "short instrumental bed"
// well enough for a 5-8s preview without needing a second music-specific
// API key just for this free tier.
async function generateElevenLabsMusic(prompt, durationSeconds, apiKey) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: prompt, duration_seconds: durationSeconds }),
  })
  if (!res.ok) throw new Error(`ElevenLabs sound-generation failed: ${res.status} ${(await res.text()).slice(0, 300)}`)
  return Buffer.from(await res.arrayBuffer())
}

// Search term built from the real brief, not a guessed genre - "what
// they do" + tone gives iTunes something concrete to match against
// (same real lesson from tonight's music-lightbox.mjs: don't filter by
// a guessed genre string, iTunes' own taxonomy rarely matches casual
// terms).
export async function generateMusic(brief, durationSeconds = 8) {
  const apiKey = process.env.ELEVEN_LABS_API_KEY
  if (!apiKey) throw new Error('ELEVEN_LABS_API_KEY not configured')

  const searchTerm = `${brief.tone || 'upbeat'} background music`
  const results = await searchReferenceTracks(searchTerm, { limit: 5 })

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adbuilder-music-'))
  let prompt = `Instrumental background music, ${brief.tone || 'upbeat'} mood, no vocals.`

  if (results.length) {
    const chosen = results[0]
    const refPath = path.join(tmp, 'ref.m4a')
    const refMp3Path = path.join(tmp, 'ref.mp3')
    await downloadPreview(chosen.previewUrl, refPath)
    await execFileAsync('ffmpeg', ['-y', '-i', refPath, refMp3Path, '-loglevel', 'error'])
    const analysis = await analyzeReferenceTrack(refMp3Path)
    prompt = buildPromptFromAnalysis({ genre: chosen.genre, analysis })
  }

  const buf = await generateElevenLabsMusic(prompt, durationSeconds, apiKey)
  const outPath = path.join(tmp, 'music.mp3')
  fs.writeFileSync(outPath, buf)
  return { path: outPath, prompt, tmpDir: tmp }
}
