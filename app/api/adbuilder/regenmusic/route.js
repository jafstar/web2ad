import fs from 'fs'
import { generateMusic } from '../../../../lib/adbuilder/music.js'

// Free-tier music regenerate for 2b, same real gap as regenscene.js
// already closed for images: ElevenLabs' sound-generation endpoint is a
// general-purpose sound model, not a dedicated music one, and
// occasionally returns something that isn't really music at all. Until
// now the only way to get a different result was starting the whole
// storyboard over. No auth, no persistence - the client owns the
// resulting data URL itself, same as beat images/narration already do.
export const maxDuration = 60

export async function POST(req) {
  try {
    const { brief, durationSeconds } = await req.json()
    if (!brief?.businessName) return Response.json({ error: 'Missing brief' }, { status: 400 })

    const music = await generateMusic(brief, Math.max(1, Math.ceil(durationSeconds || 8)))
    const musicDataUrl = `data:audio/mpeg;base64,${fs.readFileSync(music.path).toString('base64')}`
    if (music.tmpDir) { try { fs.rmSync(music.tmpDir, { recursive: true, force: true }) } catch {} }

    return Response.json({ musicDataUrl })
  } catch (e) {
    console.error('adbuilder/regenmusic failed:', e)
    return Response.json({ error: e.message || 'Could not regenerate the music' }, { status: 500 })
  }
}
