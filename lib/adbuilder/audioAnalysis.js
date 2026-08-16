// Real local audio analysis - extracts tempo (BPM) and basic dynamics
// from a reference track ourselves, rather than uploading it to a
// generation API (which triggers copyright detection, confirmed live
// against Stability's audio-to-audio endpoint). Analyzing audio we
// already have locally isn't the same act as feeding it into someone
// else's generative model - the output here is just numbers/words fed
// into a TEXT prompt, no copyrighted audio ever leaves this machine.
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import MusicTempo from 'music-tempo'
import { FFMPEG_PATH } from './ffmpegBin.js'

const execFileAsync = promisify(execFile)

async function decodeToFloat32(audioPath, sampleRate = 22050) {
  const rawPath = `${audioPath}.raw.f32`
  await execFileAsync(FFMPEG_PATH, [
    '-y', '-i', audioPath,
    '-ac', '1', '-ar', String(sampleRate), '-f', 'f32le',
    rawPath,
  ])
  const buf = fs.readFileSync(rawPath)
  fs.unlinkSync(rawPath)
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4)
}

async function getLoudnessStats(audioPath) {
  // No reset=1 this time - that printed per-frame stats and the regex
  // was grabbing the wrong occurrence, which is the real bug behind the
  // earlier dynamicRangeDb:0 result. Without reset, astats prints one
  // real "Overall" summary block at the end with correct field names.
  const { stderr } = await execFileAsync(FFMPEG_PATH, ['-i', audioPath, '-af', 'astats=metadata=1', '-f', 'null', '-'])
  const overallSection = stderr.split('Overall')[1] || stderr
  const rmsMatch = overallSection.match(/RMS level dB:\s*(-?[\d.]+)/)
  const peakMatch = overallSection.match(/Peak level dB:\s*(-?[\d.]+)/)
  return {
    rmsDb: rmsMatch ? parseFloat(rmsMatch[1]) : null,
    peakDb: peakMatch ? parseFloat(peakMatch[1]) : null,
  }
}

export async function analyzeReferenceTrack(audioPath) {
  const samples = await decodeToFloat32(audioPath)
  const mt = new MusicTempo(samples)
  const loudness = await getLoudnessStats(audioPath)

  const bpm = Math.round(mt.tempo)
  const energy = loudness.rmsDb !== null ? (loudness.rmsDb > -14 ? 'high-energy, loud' : loudness.rmsDb > -22 ? 'moderate energy' : 'quiet, gentle') : null
  const dynamicRange = loudness.rmsDb !== null && loudness.peakDb !== null ? Math.round(loudness.peakDb - loudness.rmsDb) : null

  return { bpm, energy, dynamicRangeDb: dynamicRange, beatCount: mt.beats?.length ?? 0 }
}

// Real bug fixed here, live-caught: "no vocals" tacked on at the END of
// the prompt was too weak a guard - a business's own real tone words
// (e.g. "storytelling") passed through this prompt got interpreted as
// literal CONTENT by the sound-generation model (produce the sound of
// someone telling a story = spoken narration), not as a mood descriptor.
// Leading with a forceful, unambiguous instrumental-only instruction
// first (not last) fixes the actual reported symptom - background
// "music" that sounded like someone talking.
// moodHint (optional): real bug found live - this used to build a prompt
// purely from the reference track's own measured stats (genre/BPM/
// energy/dynamics), with zero connection to the business's actual chosen
// tone preset (professional/funny/cinematic/zen). A "Zen" ad whose iTunes
// reference happened to be upbeat pop got upbeat-pop-shaped music - the
// preset was never in the loop at all. moodHint (see MUSIC_TONE_HINTS in
// music.js) is stated FIRST and explicitly overrides the reference
// track's own energy where they conflict, so the chosen tone always wins.
export function buildPromptFromAnalysis({ genre, artist, analysis, moodHint }) {
  const parts = ['Instrumental music only - absolutely no vocals, no spoken word, no narration, no talking, purely instrumental']
  if (moodHint) parts.push(`overall mood/feeling (takes priority over any of the reference's own energy below): ${moodHint}`)
  if (genre) parts.push(`in the style of ${genre}`)
  if (analysis.bpm) parts.push(`tempo around ${analysis.bpm} BPM`)
  if (analysis.energy) parts.push(analysis.energy)
  if (analysis.dynamicRangeDb != null) parts.push(analysis.dynamicRangeDb > 10 ? 'dynamic, with real ebb and flow' : 'consistent, steady dynamics')
  return parts.join(', ') + '.'
}
