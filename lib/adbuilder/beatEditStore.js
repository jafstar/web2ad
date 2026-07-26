// Small shared helpers for the beatedit/* routes - a forked v2 ad lives
// entirely as one projects row (data.editable = true), no separate
// adbuilder_runs schema. Ownership is enforced by the caller passing a
// session-scoped client (RLS's "select/update own projects" policies do
// the real restriction, see supabase/migrations/0004_projects.sql) - this
// file just finds the row and re-saves it, nothing more.

export async function loadEditableProject(supabase, user, runId) {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, data')
    .eq('project_type', 'ad')
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  const project = projects?.find((p) => p.data?.v2 && p.data?.editable && p.data?.runId === runId)
  if (!project) throw new Error('Could not find that editable ad')
  return project
}

export async function saveProjectData(supabase, projectId, data) {
  const { error } = await supabase.from('projects').update({ data }).eq('id', projectId)
  if (error) throw new Error(error.message)
}
