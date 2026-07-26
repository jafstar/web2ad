import { renderPreview } from '../../../../lib/adbuilder/preview.js'

// Real, long-running composite (image gen + TTS + music + ffmpeg) -
// explicit maxDuration since this genuinely can take 30-60s+, unlike the
// rest of this app's routes.
export const maxDuration = 120

export async function POST(req) {
  try {
    const { brief, script } = await req.json()
    if (!brief || !script) return Response.json({ error: 'Missing brief or script' }, { status: 400 })
    const result = await renderPreview({ brief, script })
    return Response.json(result)
  } catch (e) {
    console.error('adbuilder/preview failed:', e)
    return Response.json({ error: e.message || 'Could not render preview' }, { status: 500 })
  }
}
