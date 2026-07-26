import fs from 'fs'
import path from 'path'
import { mediaPaths } from '../../../../../../lib/adbuilder/shots.js'

export async function GET(req, { params }) {
  const { runId } = await params
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const shotId = Number(searchParams.get('shotId'))
  if (!['keyframe', 'render'].includes(type) || !shotId) {
    return Response.json({ error: 'Bad request' }, { status: 400 })
  }
  const paths = mediaPaths(runId, shotId)
  const filePath = type === 'keyframe' ? paths.keyframe : paths.render
  if (!fs.existsSync(filePath)) return Response.json({ error: 'Not found' }, { status: 404 })
  const buf = fs.readFileSync(filePath)
  return new Response(buf, {
    headers: { 'Content-Type': type === 'keyframe' ? 'image/jpeg' : 'video/mp4' },
  })
}
