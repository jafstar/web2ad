import { createClient } from '../../../../../lib/supabase/server'
import { searchMusic, generateMusicFromReference } from '../../../../../lib/adbuilder/playgroundMusic.js'

export const maxDuration = 60

export async function GET(req) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const term = searchParams.get('term')
  if (!term?.trim()) return Response.json({ error: 'Missing term' }, { status: 400 })
  try {
    const results = await searchMusic(term.trim())
    return Response.json({ results })
  } catch (e) {
    return Response.json({ error: e.message || 'Search failed' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })

    const { previewUrl, genre } = await req.json()
    const option = await generateMusicFromReference({ previewUrl, genre })
    return Response.json(option)
  } catch (e) {
    console.error('adbuilder/playground/music failed:', e)
    return Response.json({ error: e.message || 'Could not generate music' }, { status: 500 })
  }
}
