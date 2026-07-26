// The "snazzy ending" - a real branded end card (business name + phone
// number, animated in) rendered via htmlTextRenderer.js's serverless
// Chromium and encoded into its own short silent clip, appended after the
// main narrated ad. Deliberately kept independent of composeBeatAd's
// per-beat narration/timing logic - this is a single self-contained final
// segment, not another beat, so it can't disturb the beat pipeline's
// already-proven per-beat compositing.
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { renderTextFrames } from './htmlTextRenderer.js'
import { FFMPEG_PATH } from './ffmpegBin.js'

const execFileAsync = promisify(execFile)
const OUTRO_DURATION_SECONDS = 3
const OUTRO_FPS = 25

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

// Mixes a real extracted color toward black (ratio 0 = original color, 1
// = black) - keeps the real hue/identity of the brand color while
// guaranteeing the background stays dark enough for the card's white
// text to stay readable, regardless of how light the raw extracted color
// was. Standard "shade" technique, not a generic darken-any-color hack -
// deliberately preserves hue.
function mixWithBlack(hex, ratio) {
  const { r, g, b } = hexToRgb(hex)
  const mix = (c) => Math.round(c * (1 - ratio))
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

// Real fallback palette when no brand color was extracted (no site to
// screenshot, or extraction failed) - a deliberate, honest default, not
// a fake "brand color."
const DEFAULT_PRIMARY = '#3a2a1a'
const DEFAULT_ACCENT = '#e8a852'

function outroMarkup(businessName, phoneNumber, brandColors = []) {
  const primary = brandColors[0] || DEFAULT_PRIMARY
  const accent = brandColors[1] || DEFAULT_ACCENT

  const bodyHtml = `<div class="outro-card">
    <div class="outro-name">${escapeHtml(businessName)}</div>
    ${phoneNumber ? `<div class="outro-phone">${escapeHtml(phoneNumber)}</div>` : ''}
  </div>`
  const extraCss = `
    @keyframes outroIn { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
    .outro-card { text-align: center; animation: outroIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .outro-name { font-family: Georgia, serif; font-size: 58px; font-weight: 700; letter-spacing: 1px; color: #f4ede1; text-shadow: 0 4px 16px rgba(0,0,0,0.5); }
    .outro-phone { font-family: Arial, sans-serif; font-size: 26px; margin-top: 16px; color: ${accent}; letter-spacing: 0.5px; }
    html, body { background: radial-gradient(circle at 50% 42%, ${mixWithBlack(primary, 0.55)} 0%, ${mixWithBlack(primary, 0.85)} 100%) !important; }
  `
  return { bodyHtml, extraCss }
}

// Returns a local mp4 file path (video + silent audio track, so it mixes
// cleanly into an ffmpeg concat alongside the main narrated clip, which
// always has a real audio stream) - caller owns cleanup of tmpDir.
// brandColors (optional): [primaryHex, accentHex] extracted from a real
// screenshot of the business's own site (see brandExtract.js) - falls
// back to a fixed default palette when empty/unavailable.
export async function buildOutroClip(businessName, phoneNumber, brandColors = [], { width = 1024, height = 1024 } = {}) {
  const { bodyHtml, extraCss } = outroMarkup(businessName, phoneNumber, brandColors)
  const frames = await renderTextFrames({
    bodyHtml, extraCss, width, height,
    durationSeconds: OUTRO_DURATION_SECONDS, fps: OUTRO_FPS, omitBackground: false,
  })

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adbuilder-outro-'))
  frames.forEach((buf, i) => {
    fs.writeFileSync(path.join(tmp, `frame_${String(i + 1).padStart(4, '0')}.png`), buf)
  })

  const outPath = path.join(tmp, 'outro.mp4')
  await execFileAsync(FFMPEG_PATH, [
    '-y',
    '-framerate', String(OUTRO_FPS), '-i', path.join(tmp, 'frame_%04d.png'),
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
    '-shortest',
    '-vf', `scale=${width}:${height},setsar=1,fps=${OUTRO_FPS}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
    outPath,
  ])
  return { path: outPath, tmpDir: tmp, durationSeconds: OUTRO_DURATION_SECONDS }
}
