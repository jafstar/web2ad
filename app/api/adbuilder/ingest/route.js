import { ingestFromUrl, ingestFromText } from '../../../../lib/adbuilder/ingest.js'

// Free tier, no auth required - the whole point is a zero-friction hook
// before asking anyone to sign up. `method` picks which real ingestion
// path runs; more methods (logo/photo upload, social handle) can plug in
// here later without changing this route's shape.
export async function POST(req) {
  try {
    const { method, url, text } = await req.json()
    let brief
    if (method === 'text') {
      if (!text) return Response.json({ error: 'Missing text' }, { status: 400 })
      brief = await ingestFromText(text)
    } else {
      if (!url) return Response.json({ error: 'Missing url' }, { status: 400 })
      brief = await ingestFromUrl(url)
    }
    return Response.json({ brief })
  } catch (e) {
    console.error('adbuilder/ingest failed:', e)
    return Response.json({ error: e.message || 'Could not analyze that' }, { status: 500 })
  }
}
