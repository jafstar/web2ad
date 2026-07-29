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
import { parseJsonObject } from './claude.js'
import { callGemini } from './models/gemini.js'
import { synthesizeSpeech } from './elevenlabs-tts.js'
import { generateMusic } from './music.js'
import { generateKeyframeFor, generateMotionFor } from './shots.js'
import { uploadBufferToCloudinary } from '../cloudinary.js'
import { verticalConstraints } from './verticals.js'
import { FFMPEG_PATH, FFPROBE_PATH } from './ffmpegBin.js'
import { buildOutroClip } from './outroCard.js'
import { TONE_PRESETS } from './story.js'

export { TONE_PRESETS }

const execFileAsync = promisify(execFile)
// Real gap fixed live 2026-07-28: the narrator was hardcoded to one male
// voice with no way to change it. Both are real ElevenLabs premade
// voices confirmed on this account (lib/adbuilder/elevenlabs-tts.js's
// listVoices) - Sarah picked as Brian's female counterpart for a similar
// mature/confident register, not just "a" female voice.
export const NARRATION_VOICES = {
  male: 'nPczCjzI2devNBz1zQrb', // Brian - Deep, Resonant and Comforting
  female: 'EXAVITQu4vr4xnSDxMaL', // Sarah - Mature, Reassuring, Confident
}

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

// Same real tone guidance already proven in story.js's fast pipeline
// (TONE_HINTS / FUNNY_WRITER_SYSTEM) - reused as prompt text rather than
// imported directly, since the beat pipeline's output shape (multiple
// PHRASE/VISUAL beats) is structurally different from story.js's single
// NARRATION/VISUAL block, but the underlying creative guidance (what
// actually makes "funny" land instead of falling flat, what "cinematic"
// vs "zen" mean concretely) is identical and shouldn't be re-derived.
const BEAT_TONE_HINTS = {
  cinematic: `Elevated, cinematic tone - treat this like a premium brand film, not a fast-cut ad. Confident, atmospheric, a little slower and more mood-driven. Understated, never jokey.`,
  zen: `Minimal, calm, sensory - closer to ASMR than a sales pitch. Favor stillness, texture, and one specific quiet sensory detail per beat over plot events. Sparse - let silence and space carry weight rather than incident.`,
  funny: `This ad must be genuinely funny - real structural irony, not a pun. Before writing, pick ONE concrete, specific incongruous premise: take a real word/phrase/claim from this business's own description or trust signals and apply its full, most extreme, most literal register - completely straight-faced - to the mundane reality of actually getting/using the product. The premise must only make sense for THIS specific business, not swappable onto any other business unchanged. Do NOT reach for a generic borrowed world (no spy/heist/action-movie missions, no reality-TV competition format, no courtroom drama). Play it completely sincere and deadpan throughout every beat - never explain the joke, never wrap up with a punchline flourish.`,
}

function toneNote(tone) {
  return BEAT_TONE_HINTS[tone] ? `\n\n${BEAT_TONE_HINTS[tone]}` : ''
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

// Switched from Claude to Gemini live 2026-07-28, real product call: "let
// it loose by itself, no council no editor" - one model writes the beat
// sequence directly, no multi-model critique/revise cycle (that's what
// "no council" rules out - the old writeAdStory Council pipeline v1 still
// uses is untouched, this is specific to the beat pipeline).
export async function writeAdBeats(brief, direction = '', tone = 'professional') {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
  const vertical = verticalConstraints(brief.vertical)
  // direction is the free-text "what do you want to see made" field from
  // step 1 (or, from the new theme-picker step, the chosen story angle) -
  // a real creative steer, not just flavor text, so it's framed as a
  // requirement to follow.
  const directionNote = direction?.trim() ? `\n\nThe business owner specifically asked for: "${direction.trim()}" - follow this as a real creative requirement, not just a suggestion.` : ''
  const prompt = `${briefText(brief)}\n\nWrite the beat sequence now.${vertical.toneRegisterNote ? ` ${vertical.toneRegisterNote}` : ''}${toneNote(tone)}${directionNote}`
  const raw = await callGemini(prompt, BEAT_WRITER_SYSTEM, apiKey)

  const atmosphere = raw.match(/ATMOSPHERE:\s*(.+)/i)?.[1]?.trim() || ''
  const phrases = [...raw.matchAll(/^PHRASE:\s*(.+)$/gim)].map((m) => m[1].trim())
  const visuals = [...raw.matchAll(/^VISUAL:\s*(.+)$/gim)].map((m) => m[1].trim())
  if (!phrases.length || phrases.length !== visuals.length) throw new Error('Beat writer returned a malformed or mismatched beat sequence')

  const beats = phrases.map((phrase, i) => ({ id: i + 1, phrase, visual: visuals[i] }))
  return { beats, atmosphere }
}

// New step 2a, requested live 2026-07-28: before writing a full beat
// sequence, Gemini pitches 3-4 genuinely distinct STORY ANGLES (not full
// scripts) for the business owner to pick from - "the user selects the
// theme and then it gets rendered." The theme text itself (title + pitch)
// becomes the `direction` fed into writeAdBeats once chosen, so no
// separate "expand" function is needed - the same direction mechanism
// already used for the free-text creative-direction field carries this too.
const THEME_PITCH_SYSTEM = `You pitch short, genuinely DISTINCT story concepts for a video ad - not full scripts, just the core angle each one would take. Real commercials built around a specific character/moment beat generic "here's our product" ads - each pitch should commit to one real angle.

Output 3-4 options. Each must be a meaningfully different angle from the others (e.g. a skeptic won over, a single continuous moment of craft/process, a slice-of-life day-in-the-life, a specific customer's real problem solved) - not the same idea worded differently. Ground every option in this specific business's real facts from the brief below, not generic ad tropes.

Output ONLY a JSON object: {"themes": [{"title": "<3-6 word label>", "pitch": "<1-2 sentence description of the story angle and who/what it follows>"}, ...]}, nothing else, no markdown.`

// excludeTitles: real angles already shown (from a prior pitchThemes
// call on this same brief) - the "See More Ideas" step 2a control passes
// these back so the second batch is genuinely new, not a near-duplicate
// reroll of the same 3-4 angles.
export async function pitchThemes(brief, direction = '', tone = 'professional', excludeTitles = []) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
  const vertical = verticalConstraints(brief.vertical)
  const directionNote = direction?.trim() ? `\n\nThe business owner specifically asked for: "${direction.trim()}" - every pitch should honor this.` : ''
  const excludeNote = excludeTitles.length ? `\n\nAlready pitched, give genuinely different angles this time, not rewordings of these: ${excludeTitles.join('; ')}.` : ''
  const prompt = `${briefText(brief)}\n\nPitch the story concepts now.${vertical.toneRegisterNote ? ` ${vertical.toneRegisterNote}` : ''}${toneNote(tone)}${directionNote}${excludeNote}`
  const raw = await callGemini(prompt, THEME_PITCH_SYSTEM, apiKey)
  const parsed = parseJsonObject(raw)
  if (!parsed.themes?.length) throw new Error('Gemini returned no theme options')
  return parsed.themes
}

// The "fake video player" preview, requested live 2026-07-28 after
// tonight's real cost pain: generates everything EXCEPT the expensive
// Hailuo motion step - every beat's real image (Flux) + real narration
// (ElevenLabs) + a real music bed - so a builder can validate the whole
// story/pacing/visual direction, at a fraction of the cost of a real
// generation, before ever paying for actual motion. The client
// (StoryboardPlayer.jsx) schedules these to play back in sync using the
// EXACT same cumulative-timing math composeBeatAd uses for the real
// video, so what this previews is genuinely what the real ad's pacing
// will be, not a rough approximation.
//
// Audio comes back as inline data URLs (not Cloudinary uploads) since
// these are throwaway preview assets with no reason to persist -
// keyframes still go through generateKeyframeFor's normal Cloudinary
// upload since that function always does that regardless.
// precomputed lets the new 2a theme-picker/script-editor steps pass in
// beats already written (and edited by the business owner) instead of
// writing a SECOND, different draft here - same principle buildBeatAd's
// own precomputed param already established.
// referenceImageDataUrl (optional): a real photo the business owner
// uploaded during 2a's "character reference" step - threaded into EVERY
// beat's keyframe call (not just one, unlike beatedit's per-beat
// version) so the whole story stays visually anchored to one real
// character/product instead of Flux inventing a different person per beat.
export async function buildStoryboardPreview(brief, direction = '', { precomputed = null, referenceImageDataUrl = null } = {}) {
  console.log('[beatPipeline] Writing beat sequence (storyboard preview)...')
  const { beats, atmosphere } = precomputed || await writeAdBeats(brief, direction)

  const apiKey = process.env.ELEVEN_LABS_API_KEY
  if (!apiKey) throw new Error('ELEVEN_LABS_API_KEY not configured')

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adbuilder-storyboard-'))
  try {
    console.log('[beatPipeline] Synthesizing narration for all beats...')
    await synthesizeBeatAudio(beats, tmp, apiKey, NARRATION_VOICES[brief.voiceGender] || NARRATION_VOICES.male)

    // Same cumulative timing composeBeatAd uses for the real video - the
    // preview's pacing has to match what the real ad will actually do.
    let cursor = 0
    for (const beat of beats) {
      beat.narrationStart = cursor + LEAD_IN_SECONDS
      cursor += beat.targetDuration
    }
    const totalDuration = cursor

    console.log('[beatPipeline] Generating keyframes for all beats...')
    const previewRunId = `storyboard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    // Lighter stagger than real generation - only Hailuo (not used here)
    // had the real RPM limit that required 4s spacing; Flux hasn't shown
    // that problem, so this just avoids a thundering-herd submit.
    await Promise.all(beats.map(async (beat, i) => {
      if (i > 0) await new Promise((r) => setTimeout(r, i * 1200))
      const { url } = await generateKeyframeFor(previewRunId, beat.id, beat.visual, brief, atmosphere, '', referenceImageDataUrl)
      beat.keyframeUrl = url
      beat.audioDataUrl = `data:audio/mpeg;base64,${fs.readFileSync(beat.audioPath).toString('base64')}`
    }))

    console.log('[beatPipeline] Generating music bed...')
    const music = await generateMusic(brief, Math.ceil(totalDuration) + 2)
    const musicDataUrl = `data:audio/mpeg;base64,${fs.readFileSync(music.path).toString('base64')}`
    if (music.tmpDir) { try { fs.rmSync(music.tmpDir, { recursive: true, force: true }) } catch {} }

    return {
      atmosphere,
      totalDuration,
      musicDataUrl,
      beats: beats.map((b) => ({ id: b.id, phrase: b.phrase, visual: b.visual, targetDuration: b.targetDuration, narrationStart: b.narrationStart, keyframeUrl: b.keyframeUrl, audioDataUrl: b.audioDataUrl })),
    }
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}
  }
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
export async function synthesizeBeatAudio(beats, tmpDir, apiKey, voiceId = NARRATION_VOICES.male) {
  for (const beat of beats) {
    const buf = await synthesizeSpeech({ text: beat.phrase, apiKey, voiceId })
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
//
// Real, live-caught limit: firing every beat's Hailuo submit call at once
// via Promise.all hit "rate limit exceeded (RPM)" with 5-6 beats (the
// existing 4-shot pipeline apparently stays just under it). Staggering
// each beat's SUBMIT call by STAGGER_MS, while still letting each beat's
// own generation/poll run independently after that, keeps this working
// regardless of beat count without serializing the whole (much slower)
// generation itself.
const STAGGER_MS = 4000

// referenceImageDataUrl (optional): the same 2a character reference
// photo threaded through the free storyboard preview - carried into the
// real paid generation too, so what a business paid for stays visually
// anchored to the same reference their free preview showed them.
export async function generateBeatShots(runId, beats, brief, atmosphere, referenceImageDataUrl = null) {
  await Promise.all(beats.map(async (beat, i) => {
    if (i > 0) await new Promise((r) => setTimeout(r, i * STAGGER_MS))
    const { url: keyframeUrl, dataUrl } = await generateKeyframeFor(runId, beat.id, beat.visual, brief, atmosphere, '', referenceImageDataUrl)
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

  console.log('[beatPipeline] Final mux...')
  const finalPath = path.join(tmp, 'final.mp4')
  await execFileAsync(FFMPEG_PATH, ['-y', '-i', silentPath, '-i', mixedAudioPath, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-t', String(totalDuration), finalPath])

  // The "snazzy ending" - a real branded end card, appended after the
  // narrated ad rather than folded into the beat loop above (keeps this
  // fully independent of the per-beat narration/timing logic, so it can
  // never disturb that already-proven compositing). Best-effort: if
  // Chromium/rendering hiccups, the real ad still ships without the
  // outro rather than losing the whole generation over a card.
  // outroEnabled defaults to on (undefined !== false) - a real, deliberate
  // opt-OUT rather than opt-in, per the "adds a level of cushion" call.
  let uploadPath = finalPath
  let outroTmpDir = null
  let outroDuration = 0
  if (brief.outroEnabled !== false) {
    try {
      console.log('[beatPipeline] Rendering outro card...')
      const outro = await buildOutroClip(brief.businessName, brief.phoneNumber || null, brief.brandColors || [], brief.outroText || '')
      outroTmpDir = outro.tmpDir
      outroDuration = outro.durationSeconds
      const combinedPath = path.join(tmp, 'final-with-outro.mp4')
      await execFileAsync(FFMPEG_PATH, [
        '-y', '-i', finalPath, '-i', outro.path,
        '-filter_complex', '[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[outv][outa]',
        '-map', '[outv]', '-map', '[outa]',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
        combinedPath,
      ])
      uploadPath = combinedPath
    } catch (e) {
      console.error('[beatPipeline] Outro card failed, shipping without it:', e.message)
    }
  }

  console.log('[beatPipeline] Uploading...')
  const { url } = await uploadBufferToCloudinary(fs.readFileSync(uploadPath), `adbuilder/${runId}/beatad`, 'video')

  if (music.tmpDir) { try { fs.rmSync(music.tmpDir, { recursive: true, force: true }) } catch {} }
  if (outroTmpDir) { try { fs.rmSync(outroTmpDir, { recursive: true, force: true }) } catch {} }
  try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}

  return { url, durationSeconds: totalDuration + outroDuration, beatCount: beats.length }
}

// Top-level orchestrator - the whole beat-based ad in one call, for
// testing. runId only namespaces the Cloudinary folders (matches shots.js's
// convention); this doesn't touch adbuilder_runs/Supabase at all.
//
// precomputed lets the real v2 funnel pass in the beats+atmosphere step 2
// already wrote (and showed the visitor) instead of writing a SECOND,
// different draft here - the story that gets built is the one they saw.
export async function buildBeatAd(runId, brief, precomputed = null) {
  console.log('[beatPipeline] Writing beat sequence...')
  const { beats, atmosphere } = precomputed || await writeAdBeats(brief)

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adbuilder-beatnarr-'))
  const apiKey = process.env.ELEVEN_LABS_API_KEY
  if (!apiKey) throw new Error('ELEVEN_LABS_API_KEY not configured')

  console.log('[beatPipeline] Synthesizing per-beat narration...')
  await synthesizeBeatAudio(beats, tmp, apiKey, NARRATION_VOICES[brief.voiceGender] || NARRATION_VOICES.male)

  console.log('[beatPipeline] Generating per-beat shots...')
  await generateBeatShots(runId, beats, brief, atmosphere, brief.referenceImageDataUrl || null)

  const result = await composeBeatAd(runId, brief, beats)
  try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}

  return { ...result, atmosphere, beats: beats.map((b) => ({ id: b.id, phrase: b.phrase, visual: b.visual, targetDuration: b.targetDuration, narrationStart: b.narrationStart, keyframeUrl: b.keyframeUrl, renderUrl: b.renderUrl })) }
}
