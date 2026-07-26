import { chooseMusic } from '../../../../../../../lib/adbuilder/musicEditor.js'

export async function POST(req, { params }) {
  try {
    const { runId } = await params
    const { filename } = await req.json()
    const schema = chooseMusic(runId, filename)
    return Response.json({ schema })
  } catch (e) {
    return Response.json({ error: e.message || 'Could not select that option' }, { status: 500 })
  }
}
