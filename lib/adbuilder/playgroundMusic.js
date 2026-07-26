// Standalone, run-agnostic version of musicEditor.js's search+generate -
// the Playground needs to test music without an actual ad run backing it,
// so this returns a data URL directly instead of writing into
// .adbuilder-runs/<runId>/music/.
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { searchReferenceTracks, downloadPreview } from './musicReferenceSearch.js'
import { analyzeReferenceTrack, buildPromptFromAnalysis } from './audioAnalysis.js'
import { FFMPEG_PATH } from './ffmpegBin.js'

const execFileAsync = promisify(execFile)

export async function searchMusic(term) {
  const results = await searchReferenceTracks(term, { limit: 6 })
  return results.map((r) => ({ artist: r.artist, track: r.track, genre: r.genre, previewUrl: r.previewUrl }))
}

export async function generateMusicFromReference({ previewUrl, genre, durationSeconds = 10 }) {
  const apiKey = process.env.ELEVEN_LABS_API_KEY
  if (!apiKey) throw new Error('ELEVEN_LABS_API_KEY not configured')

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adbuilder-playground-music-'))
  let prompt = `Instrumental background music, ${genre || 'upbeat'} mood, no vocals.`
  try {
    if (previewUrl) {
      const refPath = path.join(tmp, 'ref.m4a')
      const refMp3Path = path.join(tmp, 'ref.mp3')
      await downloadPreview(previewUrl, refPath)
      await execFileAsync(FFMPEG_PATH, ['-y', '-i', refPath, refMp3Path, '-loglevel', 'error'])
      const analysis = await analyzeReferenceTrack(refMp3Path)
      prompt = buildPromptFromAnalysis({ genre, analysis })
    }

    const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: prompt, duration_seconds: durationSeconds }),
    })
    if (!res.ok) throw new Error(`ElevenLabs sound-generation failed: ${res.status} ${(await res.text()).slice(0, 300)}`)
    const buf = Buffer.from(await res.arrayBuffer())
    return { audioDataUrl: `data:audio/mpeg;base64,${buf.toString('base64')}`, prompt }
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}
  }
}
