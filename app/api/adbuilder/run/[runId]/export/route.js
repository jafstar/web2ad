import { exportFinalAd } from '../../../../../../lib/adbuilder/exportAd.js'
import { readSchema } from '../../../../../../lib/adbuilder/shots.js'

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

// Final export now lives on Cloudinary (schema.export.url) instead of
// local disk - redirect the same way media/route.js does.
export async function GET(req, { params }) {
  const { runId } = await params
  try {
    const schema = await readSchema(runId)
    if (!schema.export?.url) return Response.json({ error: 'Not exported yet' }, { status: 404 })
    return Response.redirect(schema.export.url, 302)
  } catch (e) {
    return Response.json({ error: 'Not exported yet' }, { status: 404 })
  }
}
