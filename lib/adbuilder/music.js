import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { searchReferenceTracks, downloadPreview } from './musicReferenceSearch.js'
import { analyzeReferenceTrack, buildPromptFromAnalysis } from './audioAnalysis.js'
import { FFMPEG_PATH } from './ffmpegBin.js'

const execFileAsync = promisify(execFile)
// Real, hard API limit - ElevenLabs' sound-generation endpoint rejects
// any duration_seconds above this with a 400.
const ELEVENLABS_MAX_DURATION = 30

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

// Real music-specific mood language per tone PRESET (professional/funny/
// cinematic/zen) - distinct from story.js/beatPipeline.js's
// BEAT_TONE_HINTS, which describe how to WRITE a beat (plot/premise
// language), not how music should sound. Kept as its own map rather than
// reusing those hints verbatim.
const MUSIC_TONE_HINTS = {
  professional: 'clean, confident, minimal modern-corporate instrumental - warm but restrained, subtle rhythm, no drama or bombast',
  cinematic: 'elevated, atmospheric instrumental - slow build, spacious, premium brand-film scoring, understated, no cheesy stock-music tropes',
  zen: 'minimal ambient instrumental - soft sustained tones, very sparse, generous silence and space between phrases, closer to a calming soundscape than a song, no percussion or forward-driving rhythm',
  funny: 'playful, bouncy instrumental with a light comedic bounce - quirky pizzicato strings or jaunty marimba, never generic corporate-upbeat stock music',
}
// Short phrase per preset for the iTunes search term specifically (that
// API wants a concrete, real-genre-ish query, not a full mood paragraph).
const MUSIC_TONE_SEARCH_TERMS = {
  professional: 'corporate clean modern',
  cinematic: 'cinematic orchestral trailer',
  zen: 'meditation ambient calm',
  funny: 'quirky playful upbeat',
}

// Search term built from the real brief, not a guessed genre - "what
// they do" + tone gives iTunes something concrete to match against
// (same real lesson from tonight's music-lightbox.mjs: don't filter by
// a guessed genre string, iTunes' own taxonomy rarely matches casual
// terms).
export async function generateMusic(brief, durationSeconds = 8) {
  const apiKey = process.env.ELEVEN_LABS_API_KEY
  if (!apiKey) throw new Error('ELEVEN_LABS_API_KEY not configured')

  // Real bug fixed here, live-caught ("our music really sucks for [zen]"):
  // this only ever read brief.tone - free text auto-scraped from the
  // business's own site copy during ingestion - and had NO idea the user
  // explicitly picked a Zen/Funny/Cinematic/Professional preset on step 1.
  // brief.tonePreset (now threaded through from BeatAdWizard.jsx) is the
  // real signal; brief.tone stays as a secondary fallback for the rare
  // case a preset genuinely isn't available (e.g. very old stashed briefs).
  const preset = brief.tonePreset
  const moodHint = MUSIC_TONE_HINTS[preset] || brief.tone || 'upbeat'
  const searchTerm = `${MUSIC_TONE_SEARCH_TERMS[preset] || brief.tone || 'upbeat'} background music`
  const results = await searchReferenceTracks(searchTerm, { limit: 5 })

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adbuilder-music-'))
  // Real bug fixed here, live-caught: brief.tone is real free text pulled
  // straight from the business's own site copy (e.g. "casual,
  // storytelling, nostalgic and enthusiastic") - words like "storytelling"
  // read as a literal CONTENT instruction to the sound-generation model
  // (produce the sound of someone telling a story = spoken narration),
  // not a mood descriptor, when just appended after "mood". Leading with
  // a forceful instrumental-only instruction and explicitly framing the
  // tone words as describing a FEELING (not content to generate) fixes
  // the actual reported symptom - background "music" that sounded like
  // someone talking.
  let prompt = `Instrumental music only - absolutely no vocals, no spoken word, no narration, no talking, purely instrumental. Musical feeling/energy to evoke (not literal content): ${moodHint}.`

  if (results.length) {
    // Randomized, not always the top hit - lets a user hitting "Regenerate
    // Music" (2b's free-tier control) actually land on a different real
    // reference track and therefore a different generated result, instead
    // of re-deriving the same prompt from the same #1 match every time.
    const chosen = results[Math.floor(Math.random() * results.length)]
    const refPath = path.join(tmp, 'ref.m4a')
    const refMp3Path = path.join(tmp, 'ref.mp3')
    await downloadPreview(chosen.previewUrl, refPath)
    await execFileAsync(FFMPEG_PATH, ['-y', '-i', refPath, refMp3Path, '-loglevel', 'error'])
    const analysis = await analyzeReferenceTrack(refMp3Path)
    prompt = buildPromptFromAnalysis({ genre: chosen.genre, analysis, moodHint })
  }

  // Real bug fixed here, live-caught: a real ad's total length (now often
  // longer since the beat writer's phrase-length constraint was loosened
  // for better writing - see BEAT_WRITER_SYSTEM) can exceed ElevenLabs'
  // 30s hard cap on sound-generation, which the API rejects outright
  // ("expected to be... less or equal to 30"). Requesting more isn't an
  // option, so generate at the real cap and loop the result via ffmpeg to
  // cover whatever the actual ad needs - a normal, unnoticeable technique
  // for a short ambient instrumental bed under narration.
  const requestDuration = Math.min(durationSeconds, ELEVENLABS_MAX_DURATION)
  const buf = await generateElevenLabsMusic(prompt, requestDuration, apiKey)
  const rawPath = path.join(tmp, 'music-raw.mp3')
  fs.writeFileSync(rawPath, buf)

  let outPath = rawPath
  if (durationSeconds > requestDuration) {
    outPath = path.join(tmp, 'music.mp3')
    await execFileAsync(FFMPEG_PATH, [
      '-y', '-stream_loop', '-1', '-i', rawPath, '-t', String(durationSeconds),
      '-c', 'copy', outPath, '-loglevel', 'error',
    ])
  }

  return { path: outPath, prompt, tmpDir: tmp }
}
