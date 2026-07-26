import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { FFMPEG_PATH } from '../../../../lib/adbuilder/ffmpegBin.js'
const execFileAsync = promisify(execFile)

// Temporary diagnostic - tests several zoompan expression variants against
// free, synthetic lavfi-generated inputs (no real API cost) to isolate the
// exact trigger of the production filtergraph corruption bug. Delete once
// resolved.
export async function GET() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-'))
  const img = path.join(tmp, 'img.jpg')
  await execFileAsync(FFMPEG_PATH, ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=320x320:d=1', '-frames:v', '1', img])

  const variants = {
    'with_comma_min': `[0:v]zoompan=z='min(zoom+0.0015,1.15)':d=125[v]`,
    'no_comma_plain': `[0:v]zoompan=z='zoom+0.0012':d=125[v]`,
    'no_quotes_no_comma': `[0:v]zoompan=z=1.05:d=125[v]`,
    'quoted_no_comma_no_parens': `[0:v]zoompan=z='zoom+0.001':d=125[v]`,
    'single_option_only': `[0:v]zoompan=d=125[v]`,
  }

  const results = {}
  for (const [name, graph] of Object.entries(variants)) {
    const out = path.join(tmp, `${name}.mp4`)
    const filterPath = path.join(tmp, `${name}.txt`)
    fs.writeFileSync(filterPath, graph)
    try {
      await execFileAsync(FFMPEG_PATH, ['-y', '-loop', '1', '-i', img, '-filter_complex_script', filterPath, '-map', '[v]', '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', out, '-loglevel', 'error'])
      results[name] = { ok: true }
    } catch (e) {
      results[name] = { ok: false, error: e.message.split('\n').slice(0, 3).join(' | ') }
    }
  }

  try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}
  return Response.json(results)
}
