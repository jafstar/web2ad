import { searchMusicOptions } from '../../../../../../../lib/adbuilder/musicEditor.js'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const term = searchParams.get('term')
    if (!term) return Response.json({ error: 'Missing term' }, { status: 400 })
    const results = await searchMusicOptions(term)
    return Response.json({ results })
  } catch (e) {
    return Response.json({ error: e.message || 'Search failed' }, { status: 500 })
  }
}
