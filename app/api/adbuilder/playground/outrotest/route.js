import fs from 'fs'
import { buildOutroClip } from '../../../../../lib/adbuilder/outroCard.js'

// TEMP: real-brand-color visual check, auth stripped for one curl test,
// deleted immediately after.
export const maxDuration = 120

export async function POST(req) {
  try {
    const { path: outPath, tmpDir } = await buildOutroClip('Midwood Smokehouse', null, ['#D45B2B', '#FFFFFF'])
    const buf = fs.readFileSync(outPath)
    const videoDataUrl = `data:video/mp4;base64,${buf.toString('base64')}`
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
    return Response.json({ videoDataUrl })
  } catch (e) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 })
  }
}
