import fs from 'fs'
import { musicFilePath } from '../../../../../../../lib/adbuilder/musicEditor.js'

export async function GET(req, { params }) {
  const { runId } = await params
  const { searchParams } = new URL(req.url)
  const filename = searchParams.get('f')
  if (!filename || !/^option-[\w.-]+\.mp3$/.test(filename)) return Response.json({ error: 'Bad filename' }, { status: 400 })
  const filePath = musicFilePath(runId, filename)
  if (!fs.existsSync(filePath)) return Response.json({ error: 'Not found' }, { status: 404 })
  return new Response(fs.readFileSync(filePath), { headers: { 'Content-Type': 'audio/mpeg' } })
}
