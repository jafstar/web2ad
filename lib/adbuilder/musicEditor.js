import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { searchReferenceTracks, downloadPreview } from './musicReferenceSearch.js'
import { analyzeReferenceTrack, buildPromptFromAnalysis } from './audioAnalysis.js'
import { readSchema } from './shots.js'
import { FFMPEG_PATH } from './ffmpegBin.js'

const execFileAsync = promisify(execFile)
const RUNS_DIR = path.join(process.cwd(), '.adbuilder-runs')
function musicDir(runId) { return path.join(RUNS_DIR, runId, 'music') }
function schemaPath(runId) { return path.join(RUNS_DIR, runId, 'schema.json') }

function writeSchema(runId, schema) {
  fs.writeFileSync(schemaPath(runId), JSON.stringify(schema, null, 2))
}

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

  const dir = musicDir(runId)
  fs.mkdirSync(dir, { recursive: true })

  let prompt = `Instrumental background music, ${genre || 'upbeat'} mood, no vocals.`
  if (previewUrl) {
    const refPath = path.join(dir, '_ref.m4a')
    const refMp3Path = path.join(dir, '_ref.mp3')
    await downloadPreview(previewUrl, refPath)
    await execFileAsync(FFMPEG_PATH, ['-y', '-i', refPath, refMp3Path, '-loglevel', 'error'])
    const analysis = await analyzeReferenceTrack(refMp3Path)
    prompt = buildPromptFromAnalysis({ genre, analysis })
    fs.unlinkSync(refPath); fs.unlinkSync(refMp3Path)
  }

  const buf = await generateElevenLabsMusic(prompt, durationSeconds || 15, apiKey)
  const filename = `option-${Date.now()}.mp3`
  fs.writeFileSync(path.join(dir, filename), buf)

  const schema = readSchema(runId)
  schema.musicOptions = schema.musicOptions || []
  schema.musicOptions.push({ filename, prompt, createdAt: Date.now() })
  writeSchema(runId, schema)

  return { filename, prompt }
}

export function chooseMusic(runId, filename) {
  const schema = readSchema(runId)
  if (!schema.musicOptions?.some((o) => o.filename === filename)) throw new Error('That option is not part of this run')
  schema.chosenMusic = filename
  writeSchema(runId, schema)
  return schema
}

export function musicFilePath(runId, filename) {
  return path.join(musicDir(runId), filename)
}
