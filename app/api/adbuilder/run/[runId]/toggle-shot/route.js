import { toggleShot } from '../../../../../../lib/adbuilder/shots.js'

export async function POST(req, { params }) {
  try {
    const { runId } = await params
    const { shotId } = await req.json()
    const schema = await toggleShot(runId, Number(shotId))
    return Response.json({ schema })
  } catch (e) {
    return Response.json({ error: e.message || 'Could not toggle that shot' }, { status: 500 })
  }
}
