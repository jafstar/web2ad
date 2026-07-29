import { ingestFromUrl, ingestFromText } from '../../../../lib/adbuilder/ingest.js'

// Free tier, no auth required - the whole point is a zero-friction hook
// before asking anyone to sign up. `method` picks which real ingestion
// path runs; more methods (logo/photo upload, social handle) can plug in
// here later without changing this route's shape.
//
// Real bug fixed here, live-caught: this was the one route in the whole
// adbuilder API surface with no explicit maxDuration, silently falling
// back to Vercel's platform default (well under 60s). ingestFromUrl does
// a page fetch (up to 15s) in series, then a real screenshot + vision
// call for brand-color/mascot extraction in parallel with the brief
// call (see ingest.js) - a slow real-world site can blow past a short
// default easily, and Vercel's own timeout page is HTML, not JSON,
// which is exactly what produced "Unexpected token 'A', \"An error
// o\"... is not valid JSON" on step 1.
export const maxDuration = 60

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
