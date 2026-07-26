import { execFile } from 'child_process'
import { promisify } from 'util'
import { FFMPEG_PATH } from '../../../../lib/adbuilder/ffmpegBin.js'
const execFileAsync = promisify(execFile)

// Temporary diagnostic - checking whether zoompan is actually compiled
// into ffmpeg-static's Linux binary. Delete once resolved.
export async function GET() {
  const { stdout } = await execFileAsync(FFMPEG_PATH, ['-filters'])
  const hasZoompan = stdout.includes('zoompan')
  const hasAfade = stdout.includes('afade')
  const { stdout: versionOut } = await execFileAsync(FFMPEG_PATH, ['-version'])
  return Response.json({
    hasZoompan,
    hasAfade,
    version: versionOut.split('\n')[0],
    zoompanLine: stdout.split('\n').find(l => l.includes('zoompan')) || null,
  })
}
