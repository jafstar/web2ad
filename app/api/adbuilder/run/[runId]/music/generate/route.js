import { generateMusicOption } from '../../../../../../../lib/adbuilder/musicEditor.js'
import { readSchema } from '../../../../../../../lib/adbuilder/shots.js'

export const maxDuration = 60

export async function POST(req, { params }) {
  try {
    const { runId } = await params
    const { previewUrl, genre } = await req.json()
    const schema = readSchema(runId)
    const totalDuration = schema.shots.reduce((sum, s) => sum + (s.disabled ? 0 : s.durationSeconds), 0)
    const option = await generateMusicOption(runId, { previewUrl, genre, durationSeconds: Math.max(totalDuration, 10) })
    return Response.json({ option })
  } catch (e) {
    console.error('music/generate failed:', e)
    return Response.json({ error: e.message || 'Could not generate music' }, { status: 500 })
  }
}
