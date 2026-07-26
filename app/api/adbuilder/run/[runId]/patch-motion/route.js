import { patchMotion } from '../../../../../../lib/adbuilder/shots.js'

export const maxDuration = 180

export async function POST(req, { params }) {
  try {
    const { runId } = await params
    const { shotId, fixNote } = await req.json()
    const schema = await patchMotion(runId, Number(shotId), fixNote || '')
    return Response.json({ schema })
  } catch (e) {
    console.error('patch-motion failed:', e)
    return Response.json({ error: e.message || 'Could not re-render that shot' }, { status: 500 })
  }
}
