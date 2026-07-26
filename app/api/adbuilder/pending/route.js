import { createClient } from '../../../../lib/supabase/server'

// Records the account-linked placeholder the moment someone reaches the
// confirm screen, before they've clicked "Generate My Full Ad" - cheap (one
// row, no generation spend), so it doesn't violate the "long tasks need an
// explicit trigger" rule, but it means abandoning the confirm screen (back
// button, closed tab) still leaves something real to find under My Ads
// instead of silently vanishing. Idempotent per stashId so reloading the
// confirm screen doesn't create duplicates.
export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })

    const { stashId, businessName, whatTheyDo } = await req.json()
    if (!stashId || !businessName) return Response.json({ error: 'Missing stashId or businessName' }, { status: 400 })

    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('project_type', 'ad')
      .eq('user_id', user.id)
      .contains('data', { stashId })
      .maybeSingle()
    if (existing) return Response.json({ ok: true, id: existing.id })

    const { count } = await supabase.from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('project_type', 'ad')
      .eq('name', businessName)

    const { data: inserted, error } = await supabase.from('projects').insert({
      user_id: user.id,
      name: businessName,
      project_type: 'ad',
      data: { stashId, businessName, whatTheyDo, take: (count || 0) + 1, status: 'pending' },
    }).select('id').single()
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ ok: true, id: inserted.id })
  } catch (e) {
    console.error('adbuilder/pending failed:', e)
    return Response.json({ error: e.message || 'Could not save your progress' }, { status: 500 })
  }
}
