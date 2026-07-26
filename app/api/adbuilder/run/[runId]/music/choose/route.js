import { chooseMusic } from '../../../../../../../lib/adbuilder/musicEditor.js'

export async function POST(req, { params }) {
  try {
    const { runId } = await params
    const { url } = await req.json()
    const schema = await chooseMusic(runId, url)
    return Response.json({ schema })
  } catch (e) {
    return Response.json({ error: e.message || 'Could not select that option' }, { status: 500 })
  }
}
