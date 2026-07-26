import { readSchema } from '../../../../../lib/adbuilder/shots.js'

// Open (no auth re-check) - the runId itself (timestamp + random suffix)
// is the access token for this demo. Real per-user ownership checks are
// a real gap to close before this handles actual paying traffic, not
// something to fake tonight.
export async function GET(req, { params }) {
  try {
    const { runId } = await params
    const schema = await readSchema(runId)
    return Response.json({ schema })
  } catch (e) {
    return Response.json({ error: 'Run not found' }, { status: 404 })
  }
}
