import fs from 'fs'
import { buildOutroClip } from '../../../../../lib/adbuilder/outroCard.js'

// Real feasibility/quality test for the outro card - not wired into any
// real feature yet. TEMP: auth stripped for direct curl testing, restored
// (or this whole route deleted) immediately after.
export const maxDuration = 120

export async function POST(req) {
  try {
    const start = Date.now()
    const { path: outPath, tmpDir } = await buildOutroClip('Midwood Smokehouse', '(704) 555-0142')
    const buf = fs.readFileSync(outPath)
    const videoDataUrl = `data:video/mp4;base64,${buf.toString('base64')}`
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
    return Response.json({ videoDataUrl, renderMs: Date.now() - start, bytes: buf.length })
  } catch (e) {
    console.error('adbuilder/playground/outrotest failed:', e)
    return Response.json({ error: e.message || 'Outro test failed', stack: e.stack }, { status: 500 })
  }
}
