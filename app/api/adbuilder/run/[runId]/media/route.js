import { readSchema } from '../../../../../../lib/adbuilder/shots.js'

// Keyframe/render media now live on Cloudinary (see runStore.js) instead
// of local disk - this route stays as a stable URL the frontend already
// points <img>/<video> tags at, just redirecting to the real Cloudinary
// URL instead of streaming a local file.
export async function GET(req, { params }) {
  const { runId } = await params
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const shotId = Number(searchParams.get('shotId'))
  if (!['keyframe', 'render'].includes(type) || !shotId) {
    return Response.json({ error: 'Bad request' }, { status: 400 })
  }
  try {
    const schema = await readSchema(runId)
    const shot = schema.shots.find((s) => s.id === shotId)
    const url = type === 'keyframe' ? shot?.keyframeUrl : shot?.renderUrl
    if (!url) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.redirect(url, 302)
  } catch (e) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
}
