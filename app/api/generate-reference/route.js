import { createClient } from '../../../lib/supabase/server'
import { generateGemini } from '../../../lib/engines/gemini'

// Story type's reference generator - distinct from /api/idea-generate
// (which picks a random subject with zero input). This one takes the
// user's own description: "describe a character once, get a locked
// identity to sweep across scenes" only works if it's THEIR character,
// not a random pick.
export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const { description } = await request.json()
  if (!description?.trim()) return Response.json({ error: 'description is required' }, { status: 400 })

  try {
    const dataUrl = await generateGemini(`${description.trim()}, standing portrait, plain neutral background, front-facing`)
    return Response.json({ dataUrl })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
