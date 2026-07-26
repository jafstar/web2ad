import { patchKeyframe } from '../../../../../../lib/adbuilder/shots.js'

export const maxDuration = 180

export async function POST(req, { params }) {
  try {
    const { runId } = await params
    const { shotId, fixNote } = await req.json()
    const schema = await patchKeyframe(runId, Number(shotId), fixNote || '')
    return Response.json({ schema })
  } catch (e) {
    console.error('patch-keyframe failed:', e)
    return Response.json({ error: e.message || 'Could not regenerate that shot' }, { status: 500 })
  }
}
