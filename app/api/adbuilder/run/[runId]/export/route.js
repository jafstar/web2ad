import { exportFinalAd } from '../../../../../../lib/adbuilder/exportAd.js'
import { readSchema } from '../../../../../../lib/adbuilder/shots.js'
import { proxyDownload } from '../../../../../../lib/adbuilder/downloadProxy.js'

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

// Final export lives on Cloudinary (schema.export.url) - proxied back
// with a real Content-Disposition: attachment header (see
// downloadProxy.js) rather than a redirect, so the Download button
// actually downloads instead of navigating the tab to the raw video.
export async function GET(req, { params }) {
  const { runId } = await params
  try {
    const schema = await readSchema(runId)
    if (!schema.export?.url) return Response.json({ error: 'Not exported yet' }, { status: 404 })
    return proxyDownload(schema.export.url, 'ad.mp4')
  } catch (e) {
    return Response.json({ error: 'Not exported yet' }, { status: 404 })
  }
}
