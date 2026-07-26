import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { FFMPEG_PATH } from '../../../../lib/adbuilder/ffmpegBin.js'
const execFileAsync = promisify(execFile)

// Temporary diagnostic - incrementally rebuilds the real preview.js
// pipeline's complexity (3 inputs, video+audio maps) using free synthetic
// lavfi inputs to isolate exactly what combination triggers the
// production filtergraph corruption. Delete once resolved.
export async function GET() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-'))
  const img = path.join(tmp, 'img.jpg')
  const narr = path.join(tmp, 'narr.mp3')
  const music = path.join(tmp, 'music.mp3')
  await execFileAsync(FFMPEG_PATH, ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=320x320:d=1', '-frames:v', '1', img])
  await execFileAsync(FFMPEG_PATH, ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '5', narr])
  await execFileAsync(FFMPEG_PATH, ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '5', music])

  const cases = [
    {
      name: 'A_zoompan_plus_passthrough_audio',
      inputs: ['-loop', '1', '-i', img, '-i', narr],
      graph: `[0:v]zoompan=z='min(zoom+0.0015,1.15)':d=125[v]`,
      maps: ['-map', '[v]', '-map', '1:a'],
    },
    {
      name: 'B_zoompan_plus_two_audio_inputs_passthrough',
      inputs: ['-loop', '1', '-i', img, '-i', narr, '-i', music],
      graph: `[0:v]zoompan=z='min(zoom+0.0015,1.15)':d=125[v]`,
      maps: ['-map', '[v]', '-map', '1:a'],
    },
    {
      name: 'C_zoompan_plus_amix_no_fade',
      inputs: ['-loop', '1', '-i', img, '-i', narr, '-i', music],
      graph: `[0:v]zoompan=z='min(zoom+0.0015,1.15)':d=125[v];[1:a][2:a]amix=inputs=2[a]`,
      maps: ['-map', '[v]', '-map', '[a]'],
    },
    {
      name: 'D_zoompan_plus_amix_plus_single_afade',
      inputs: ['-loop', '1', '-i', img, '-i', narr, '-i', music],
      graph: `[0:v]zoompan=z='min(zoom+0.0015,1.15)':d=125[v];[1:a][2:a]amix=inputs=2[mixed];[mixed]afade=t=out:st=4.4:d=0.6[a]`,
      maps: ['-map', '[v]', '-map', '[a]'],
    },
    {
      name: 'E_video_only_two_audio_inputs_unused',
      inputs: ['-loop', '1', '-i', img, '-i', narr, '-i', music],
      graph: `[0:v]zoompan=z='min(zoom+0.0015,1.15)':d=125[v]`,
      maps: ['-map', '[v]', '-map', '1:a'],
    },
    {
      name: 'F_EXACT_current_preview_js_graph',
      inputs: ['-loop', '1', '-i', img, '-i', narr, '-i', music],
      graph: `[0:v]scale=1280:1280[vpre];` +
        `[vpre]zoompan=z='min(zoom+0.0015,1.15)':d=125[vz];` +
        `[vz]fps=25[vfps];` +
        `[vfps]scale=1024:1024[vs2];` +
        `[vs2]setsar=1[v];` +
        `[2:a]volume=0.35[am];` +
        `[1:a][am]amix=inputs=2:duration=first:dropout_transition=0[mixed];` +
        `[mixed]afade=t=out:st=4.4:d=0.6[a]`,
      maps: ['-map', '[v]', '-map', '[a]'],
    },
    {
      name: 'G_zoompan_from_intermediate_label_only',
      inputs: ['-loop', '1', '-i', img],
      graph: `[0:v]scale=1280:1280[vpre];[vpre]zoompan=z='min(zoom+0.0015,1.15)':d=125[v]`,
      maps: ['-map', '[v]'],
      videoOnly: true,
    },
  ]

  const results = {}
  for (const c of cases) {
    const out = path.join(tmp, `${c.name}.mp4`)
    const filterPath = path.join(tmp, `${c.name}.txt`)
    fs.writeFileSync(filterPath, c.graph)
    const codecArgs = c.videoOnly
      ? ['-c:v', 'libx264', '-pix_fmt', 'yuv420p']
      : ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac']
    try {
      await execFileAsync(FFMPEG_PATH, ['-y', ...c.inputs, '-filter_complex_script', filterPath, ...c.maps, '-t', '1', ...codecArgs, out, '-loglevel', 'error'])
      results[c.name] = { ok: true }
    } catch (e) {
      results[c.name] = { ok: false, error: e.message.split('\n').slice(0, 3).join(' | ') }
    }
  }

  try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}
  return Response.json(results)
}
