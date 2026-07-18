import { createClient } from '../../../../lib/supabase/server'

export async function GET(_request, { params }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
  if (error) return Response.json({ error: error.message }, { status: 404 })
  return Response.json(data)
}

export async function PATCH(request, { params }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json()
  const update = {}
  if ('data' in body) update.data = body.data
  if ('name' in body) update.name = body.name

  const { data, error } = await supabase
    .from('projects')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_request, { params }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ deleted: true })
}
