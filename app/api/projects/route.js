import { createClient } from '../../../lib/supabase/server'

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

  const { name, projectType } = await request.json()
  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name, project_type: projectType || 'photos', data: {} })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
