// Real, separate pipeline requested live 2026-07-26, after tracing
// story-glue's SNAKZ v4 build (build-snakz-v4-final.mjs) as the concrete
// reference for "our best video, the least edited." That script's actual
// production model is fundamentally different from what web2ad does
// today: narration split into discrete phrase clips (not one continuous
// TTS read), each with a real lead-in gap before speech starts, shot
// durations custom-matched to each phrase's own measured length (not a
// fixed 6s/10s/30s tier), and music faded out exactly as the closing
// phrase begins. That's what makes it read as edited instead of "four
// random prompts with narration on top" - the thing a business owner
// could already do themselves. This file brings that model to web2ad as
// an entirely additive pipeline - it reuses the real generation calls
// (Flux/Hailuo/Seedance/Cloudinary, exported from shots.js) but nothing
// in shots.js/story.js/exportAd.js is modified. Nothing existing breaks
// if this never gets wired into the real funnel.
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { callClaude } from './claude.js'
import { synthesizeSpeech } from './elevenlabs-tts.js'
import { generateMusic } from './music.js'
import { generateKeyframeFor, generateMotionFor } from './shots.js'
import { uploadBufferToCloudinary } from '../cloudinary.js'
import { verticalConstraints } from './verticals.js'
import { FFMPEG_PATH, FFPROBE_PATH } from './ffmpegBin.js'

const execFileAsync = promisify(execFile)
const NARRATION_VOICE_ID = 'nPczCjzI2devNBz1zQrb' // Brian - same voice as everywhere else in this app

// Real, deliberate value - matches the ~0.1-0.15s gap SNAKZ v4 used to fix
// "the garbled/rushed opening" (speech starting instantly on the cut read
// as rushed; a beat of visual-only lets the cut register first). Also
// used as a small tail buffer after each phrase so a cut never lands
// exactly on the last word.
const LEAD_IN_SECONDS = 0.15
const TAIL_SECONDS = 0.15
// Every beat renders at this fixed engine tier (Hailuo's real minimum),
// then gets TRIMMED down to its own real target duration during
// compositing - Hailuo/Seedance can't generate arbitrary short durations
// natively, same constraint SNAKZ v4 worked around by trimming
// full-length renders rather than requesting custom lengths from the
// video engine itself.
const RENDER_DURATION_SECONDS = 6

function briefText(brief) {
  return `Business: ${brief.businessName}\nWhat they do: ${brief.whatTheyDo}\nTone: ${brief.tone}\nTrust signals: ${(brief.trustSignals || []).join('; ')}`
}

const BEAT_WRITER_SYSTEM = `You write a short real story broken into a sequence of BEATS for a video ad - not one continuous paragraph read over unrelated clips, a real sequence of short spoken phrases, each one its own beat/shot, that together read as one continuously edited moment. Real commercials cut on rhythm, not on paragraph breaks.

This is a real story - one specific character, a real want, a real beginning/middle/end, the same discipline any ad narration needs - just delivered as short beats instead of one long block.

Each beat needs exactly two lines:
PHRASE: a short natural spoken phrase, roughly 4-10 words - the kind of thing that gets its own breath and its own shot, not a sentence fragment cut mid-thought.
VISUAL: a one-sentence, concrete, filmable scene for that exact phrase (who/what is on screen, setting, action).

Read in order, the phrases must form ONE continuous, coherent story - the same character and moment carrying through, not four unrelated stock clips with a voiceover layered on top. The visual for each beat should follow directly from the beat before it, the way real film coverage of one continuous action would (a hand reaching, then the object in hand, then the result), not jump to a disconnected new scene each time.

4 to 6 beats total. End on a natural, ungimmicky mention of the business - it should feel like part of the story's own world, not a tacked-on slogan. The image generator cannot render legible text, words, or logos - no beat's visual may depend on on-screen text being readable.

Output in EXACTLY this format, nothing before or after, no markdown:
ATMOSPHERE: <shared lighting/mood/time-of-day, locked across every beat>
PHRASE: <beat 1 phrase>
VISUAL: <beat 1 visual>
PHRASE: <beat 2 phrase>
VISUAL: <beat 2 visual>
(continue for all beats)`

export async function writeAdBeats(brief) {
  const vertical = verticalConstraints(brief.vertical)
  const prompt = `${briefText(brief)}\n\nWrite the beat sequence now.${vertical.toneRegisterNote ? ` ${vertical.toneRegisterNote}` : ''}`
  const raw = await callClaude(prompt, BEAT_WRITER_SYSTEM, 1500)

  const atmosphere = raw.match(/ATMOSPHERE:\s*(.+)/i)?.[1]?.trim() || ''
  const phrases = [...raw.matchAll(/^PHRASE:\s*(.+)$/gim)].map((m) => m[1].trim())
  const visuals = [...raw.matchAll(/^VISUAL:\s*(.+)$/gim)].map((m) => m[1].trim())
  if (!phrases.length || phrases.length !== visuals.length) throw new Error('Beat writer returned a malformed or mismatched beat sequence')

  const beats = phrases.map((phrase, i) => ({ id: i + 1, phrase, visual: visuals[i] }))
  return { beats, atmosphere }
}

async function measureDuration(filePath) {
  const { stdout } = await execFileAsync(FFPROBE_PATH, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath])
  return parseFloat(stdout.trim()) || 1
}

// Synthesizes each beat's own narration clip and measures its REAL
// spoken length - this measured length (not a word-count estimate) is
// what drives that beat's target shot duration, same principle
// exportAd.js already uses for the full narration block, just applied
// per-beat instead of once.
export async function synthesizeBeatAudio(beats, tmpDir, apiKey) {
  for (const beat of beats) {
    const buf = await synthesizeSpeech({ text: beat.phrase, apiKey, voiceId: NARRATION_VOICE_ID })
    const audioPath = path.join(tmpDir, `beat-${beat.id}-narr.mp3`)
    fs.writeFileSync(audioPath, buf)
    beat.audioPath = audioPath
    beat.audioDuration = await measureDuration(audioPath)
    beat.targetDuration = LEAD_IN_SECONDS + beat.audioDuration + TAIL_SECONDS
  }
  return beats
}

// Generates each beat's real keyframe + motion clip via the exact same
// Flux/Hailuo/Seedance calls the existing pipeline uses (imported from
// shots.js, not reimplemented) - always at the fixed render tier, since
// the trim-to-target-duration happens later in composeBeatAd.
export async function generateBeatShots(runId, beats, brief, atmosphere) {
  await Promise.all(beats.map(async (beat) => {
    const { url: keyframeUrl, dataUrl } = await generateKeyframeFor(runId, beat.id, beat.visual, brief, atmosphere)
    beat.keyframeUrl = keyframeUrl
    const renderUrl = await generateMotionFor(runId, beat.id, dataUrl, beat.visual, RENDER_DURATION_SECONDS)
    beat.renderUrl = renderUrl
  }))
  return beats
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`)
  fs.writeFileSync(destPath, Buffer.from(await res.arrayBuffer()))
}

// The real SNAKZ-model compositor: trims each beat's full render down to
// its own real target duration, concatenates them silently, then places
// each beat's narration clip at its own precise start time (LEAD_IN_SECONDS
// after that beat's shot begins, not instantly on the cut) rather than
// reading the whole narration as one continuous block over unrelated
// fixed-length shots. Music gets a real fade-out timed to end exactly as
// the closing beat's narration begins - "end it with the narrator," same
// as the reference build's own comment.
export async function composeBeatAd(runId, brief, beats) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adbuilder-beatad-'))

  console.log('[beatPipeline] Downloading + trimming beat clips...')
  const trimmedPaths = await Promise.all(beats.map(async (beat) => {
    const rawPath = path.join(tmp, `beat-${beat.id}-raw.mp4`)
    await downloadToFile(beat.renderUrl, rawPath)
    const trimmedPath = path.join(tmp, `beat-${beat.id}-trim.mp4`)
    await execFileAsync(FFMPEG_PATH, [
      '-y', '-i', rawPath, '-t', String(beat.targetDuration),
      '-vf', 'scale=1024:1024:force_original_aspect_ratio=decrease,pad=1024:1024:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25',
      '-c:v', 'libx264', trimmedPath,
    ])
    return trimmedPath
  }))

  console.log('[beatPipeline] Concatenating silent video track...')
  const silentPath = path.join(tmp, 'silent.mp4')
  const inputArgs = trimmedPaths.flatMap((p) => ['-i', p])
  const concatInputs = trimmedPaths.map((_, i) => `[${i}:v]`).join('')
  await execFileAsync(FFMPEG_PATH, ['-y', ...inputArgs, '-filter_complex', `${concatInputs}concat=n=${trimmedPaths.length}:v=1:a=0[outv]`, '-map', '[outv]', '-c:v', 'libx264', silentPath])

  // Each beat's own narration starts LEAD_IN_SECONDS after that beat's
  // shot begins - cumulative start times, not evenly spaced.
  let cursor = 0
  for (const beat of beats) {
    beat.narrationStart = cursor + LEAD_IN_SECONDS
    cursor += beat.targetDuration
  }
  const totalDuration = cursor

  console.log('[beatPipeline] Preparing music bed...')
  const music = await generateMusic(brief, Math.ceil(totalDuration) + 2)

  console.log('[beatPipeline] Mixing beat-by-beat narration + music...')
  const lastBeat = beats[beats.length - 1]
  const fadeStart = Math.max(lastBeat.narrationStart - 0.3, 0)
  const fadeDuration = Math.max(totalDuration - fadeStart, 0.5)
  const audioInputArgs = [music.path, ...beats.map((b) => b.audioPath)].flatMap((p) => ['-i', p])
  const delayLabels = beats.map((b, i) => `[${i + 1}:a]adelay=${Math.round(b.narrationStart * 1000)}|${Math.round(b.narrationStart * 1000)}[n${i}]`).join(';')
  const narrLabels = beats.map((_, i) => `[n${i}]`).join('')
  const amixFilter = `[0:a]volume=0.3,afade=t=out:st=${fadeStart}:d=${fadeDuration}[bg];${delayLabels};[bg]${narrLabels}amix=inputs=${beats.length + 1}:duration=first:dropout_transition=0[mixed]`
  const mixedAudioPath = path.join(tmp, 'mixed-audio.mp3')
  await execFileAsync(FFMPEG_PATH, ['-y', ...audioInputArgs, '-filter_complex', amixFilter, '-map', '[mixed]', '-t', String(totalDuration), mixedAudioPath])

  console.log('[beatPipeline] Final mux + upload...')
  const finalPath = path.join(tmp, 'final.mp4')
  await execFileAsync(FFMPEG_PATH, ['-y', '-i', silentPath, '-i', mixedAudioPath, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-t', String(totalDuration), finalPath])
  const { url } = await uploadBufferToCloudinary(fs.readFileSync(finalPath), `adbuilder/${runId}/beatad`, 'video')

  if (music.tmpDir) { try { fs.rmSync(music.tmpDir, { recursive: true, force: true }) } catch {} }
  try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}

  return { url, durationSeconds: totalDuration, beatCount: beats.length }
}

// Top-level orchestrator - the whole beat-based ad in one call, for
// testing. runId only namespaces the Cloudinary folders (matches shots.js's
// convention); this doesn't touch adbuilder_runs/Supabase at all.
export async function buildBeatAd(runId, brief) {
  console.log('[beatPipeline] Writing beat sequence...')
  const { beats, atmosphere } = await writeAdBeats(brief)

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adbuilder-beatnarr-'))
  const apiKey = process.env.ELEVEN_LABS_API_KEY
  if (!apiKey) throw new Error('ELEVEN_LABS_API_KEY not configured')

  console.log('[beatPipeline] Synthesizing per-beat narration...')
  await synthesizeBeatAudio(beats, tmp, apiKey)

  console.log('[beatPipeline] Generating per-beat shots...')
  await generateBeatShots(runId, beats, brief, atmosphere)

  const result = await composeBeatAd(runId, brief, beats)
  try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}

  return { ...result, atmosphere, beats: beats.map((b) => ({ id: b.id, phrase: b.phrase, visual: b.visual, targetDuration: b.targetDuration, narrationStart: b.narrationStart })) }
}
