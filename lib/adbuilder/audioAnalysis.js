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

const execFileAsync = promisify(execFile)

async function decodeToFloat32(audioPath, sampleRate = 22050) {
  const rawPath = `${audioPath}.raw.f32`
  await execFileAsync('ffmpeg', [
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
  const { stderr } = await execFileAsync('ffmpeg', ['-i', audioPath, '-af', 'astats=metadata=1', '-f', 'null', '-'])
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

export function buildPromptFromAnalysis({ genre, artist, analysis }) {
  const parts = []
  if (genre) parts.push(`Instrumental track in the style of ${genre}`)
  if (analysis.bpm) parts.push(`tempo around ${analysis.bpm} BPM`)
  if (analysis.energy) parts.push(analysis.energy)
  if (analysis.dynamicRangeDb != null) parts.push(analysis.dynamicRangeDb > 10 ? 'dynamic, with real ebb and flow' : 'consistent, steady dynamics')
  parts.push('no vocals')
  return parts.join(', ') + '.'
}
