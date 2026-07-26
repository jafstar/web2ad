import fs from 'fs'
import path from 'path'

// Real problem this solves: a magic-link email very often gets opened in
// a DIFFERENT browser tab than the one that requested it, so sessionStorage
// (tab-scoped) can't carry the brief+script across that gap. A small
// server-side stash, keyed by a random id passed through the whole auth
// redirect chain, survives that correctly.
const STASH_DIR = path.join(process.cwd(), '.adbuilder-runs', '_stash')

export async function POST(req) {
  const { brief, script, previewImage } = await req.json()
  if (!brief || !script) return Response.json({ error: 'Missing brief or script' }, { status: 400 })
  fs.mkdirSync(STASH_DIR, { recursive: true })
  const stashId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  fs.writeFileSync(path.join(STASH_DIR, `${stashId}.json`), JSON.stringify({ brief, script, previewImage }))
  return Response.json({ stashId })
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const stashId = searchParams.get('id')
  if (!stashId || !/^[\w-]+$/.test(stashId)) return Response.json({ error: 'Bad stash id' }, { status: 400 })
  const filePath = path.join(STASH_DIR, `${stashId}.json`)
  if (!fs.existsSync(filePath)) return Response.json({ error: 'Stash not found or expired' }, { status: 404 })
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  return Response.json(data)
}
