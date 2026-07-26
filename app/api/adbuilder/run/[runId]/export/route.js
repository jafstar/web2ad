import fs from 'fs'
import { exportFinalAd, exportFilePath } from '../../../../../../lib/adbuilder/exportAd.js'

// Real, potentially slow composite (TTS + music + multi-clip ffmpeg concat)
// - shorter than the per-shot generation step but still genuinely slow.
export const maxDuration = 120

export async function POST(req, { params }) {
  try {
    const { runId } = await params
    const result = await exportFinalAd(runId)
    return Response.json(result)
  } catch (e) {
    console.error('adbuilder/export failed:', e)
    return Response.json({ error: e.message || 'Could not export your ad' }, { status: 500 })
  }
}

export async function GET(req, { params }) {
  const { runId } = await params
  const filePath = exportFilePath(runId)
  if (!fs.existsSync(filePath)) return Response.json({ error: 'Not exported yet' }, { status: 404 })
  const buf = fs.readFileSync(filePath)
  return new Response(buf, { headers: { 'Content-Type': 'video/mp4' } })
}
