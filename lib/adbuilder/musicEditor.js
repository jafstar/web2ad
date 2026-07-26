import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { searchReferenceTracks, downloadPreview } from './musicReferenceSearch.js'
import { analyzeReferenceTrack, buildPromptFromAnalysis } from './audioAnalysis.js'
import { readSchema, writeSchema } from './shots.js'
import { FFMPEG_PATH } from './ffmpegBin.js'
import { uploadBufferToCloudinary } from '../cloudinary.js'

const execFileAsync = promisify(execFile)

// Real production bug fixed here: this used to write generated music
// options as local files under process.cwd()/.adbuilder-runs/<runId>/music/
// - broken on Vercel the same way as shots.js (see its own comment for the
// full writeup). Generated options now upload to Cloudinary; schema.
// musicOptions[].url and schema.chosenMusic hold Cloudinary URLs directly
// - playable straight from <audio src>, no local-file proxy route needed
// anymore (the old /music/file route is gone).

async function generateElevenLabsMusic(prompt, durationSeconds, apiKey) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: prompt, duration_seconds: durationSeconds }),
  })
  if (!res.ok) throw new Error(`ElevenLabs sound-generation failed: ${res.status} ${(await res.text()).slice(0, 300)}`)
  return Buffer.from(await res.arrayBuffer())
}

// Real user control, not the free-preview tier's auto-pick: search
// returns real candidate reference tracks for the user to choose among,
// same iTunes-search-first idea proven in tonight's music-lightbox.mjs,
// just with the human back in the loop instead of always taking result 0.
export async function searchMusicOptions(term) {
  const results = await searchReferenceTracks(term, { limit: 6 })
  return results.map((r) => ({ artist: r.artist, track: r.track, genre: r.genre, previewUrl: r.previewUrl }))
}

// Generates from a specific chosen reference (by previewUrl, so the same
// exact track the user heard/picked in search results is what gets
// analyzed) - real duration matches the ad's real total length, not a
// fixed preview window.
export async function generateMusicOption(runId, { previewUrl, genre, durationSeconds }) {
  const apiKey = process.env.ELEVEN_LABS_API_KEY
  if (!apiKey) throw new Error('ELEVEN_LABS_API_KEY not configured')

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adbuilder-musicopt-'))

  let prompt = `Instrumental background music, ${genre || 'upbeat'} mood, no vocals.`
  if (previewUrl) {
    const refPath = path.join(tmp, '_ref.m4a')
    const refMp3Path = path.join(tmp, '_ref.mp3')
    await downloadPreview(previewUrl, refPath)
    await execFileAsync(FFMPEG_PATH, ['-y', '-i', refPath, refMp3Path, '-loglevel', 'error'])
    const analysis = await analyzeReferenceTrack(refMp3Path)
    prompt = buildPromptFromAnalysis({ genre, analysis })
  }

  const buf = await generateElevenLabsMusic(prompt, durationSeconds || 15, apiKey)
  const { url } = await uploadBufferToCloudinary(buf, `adbuilder/${runId}/music`, 'video')
  try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}

  const schema = await readSchema(runId)
  schema.musicOptions = schema.musicOptions || []
  schema.musicOptions.push({ url, prompt, createdAt: Date.now() })
  await writeSchema(runId, schema)

  return { url, prompt }
}

export async function chooseMusic(runId, url) {
  const schema = await readSchema(runId)
  if (!schema.musicOptions?.some((o) => o.url === url)) throw new Error('That option is not part of this run')
  schema.chosenMusic = url
  await writeSchema(runId, schema)
  return schema
}

// Downloads the chosen option's Cloudinary URL into a fresh local temp
// file - exportAd.js's ffmpeg composite needs a real local path, and a
// Cloudinary URL isn't guaranteed to still be reachable via ffmpeg's own
// HTTP input handling the same way (auth headers, redirects) as a plain
// downloaded file.
export async function downloadChosenMusic(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch chosen music: ${res.status}`)
  fs.writeFileSync(destPath, Buffer.from(await res.arrayBuffer()))
}
