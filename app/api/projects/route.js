import { createClient } from '../../../lib/supabase/server'
import { PROJECT_LIMIT, isWhitelisted } from '../../../lib/limits'

// Real user-session-scoped client (RLS enforces user_id = auth.uid()) —
// unlike credits/generate, these are genuinely user-owned reads/writes,
// same trust boundary designpipe-app's own db.js has (no admin client
// needed here at all).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, project_type, created_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })

  if (!isWhitelisted(user.email)) {
    const { count, error: countError } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
    if (countError) return Response.json({ error: countError.message }, { status: 500 })
    if (count >= PROJECT_LIMIT) {
      return Response.json({ error: `You've reached the ${PROJECT_LIMIT}-project limit for the beta.`, code: 'project_limit', limit: PROJECT_LIMIT }, { status: 403 })
    }
  }

  const { name, projectType } = await request.json()
  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name, project_type: projectType || 'photos', data: {} })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
