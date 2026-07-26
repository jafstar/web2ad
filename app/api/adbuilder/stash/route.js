import { createAdminClient } from '../../../../lib/supabase/admin'
import { uploadToCloudinary } from '../../../../lib/cloudinary'

// Real problem this solves: a magic-link email very often gets opened in
// a DIFFERENT browser tab than the one that requested it, so sessionStorage
// (tab-scoped) can't carry the brief+script across that gap. A small
// server-side stash, keyed by a random id passed through the whole auth
// redirect chain, survives that correctly.
//
// Real production bug fixed here: this used to write a local JSON file
// under process.cwd()/.adbuilder-runs/_stash/ - process.cwd() is the
// deployed bundle's READ-ONLY directory on Vercel, so every write threw,
// and the uncaught exception came back to the client as a malformed
// response body ("Unexpected end of JSON input" trying to parse it).
// adbuilder_stash (see supabase/migrations/0007_adbuilder_runs.sql) is the
// real fix - also survives the POST and GET landing on different
// serverless containers, which even a /tmp-based fix wouldn't. Admin
// client since this runs before the user necessarily has a session (the
// free-tier flow stashes before the signup/login detour).
export async function POST(req) {
  const { brief, script, previewImage } = await req.json()
  if (!brief || !script) return Response.json({ error: 'Missing brief or script' }, { status: 400 })

  let previewImageUrl = null
  if (previewImage) {
    try {
      const { url } = await uploadToCloudinary(previewImage, 'web2ad/stash')
      previewImageUrl = url
    } catch (e) {
      console.error('stash: preview image upload failed, continuing without it:', e.message)
    }
  }

  const stashId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const supabase = createAdminClient()
  const { error } = await supabase.from('adbuilder_stash').insert({
    id: stashId, brief, script, preview_image_url: previewImageUrl,
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ stashId })
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const stashId = searchParams.get('id')
  if (!stashId || !/^[\w-]+$/.test(stashId)) return Response.json({ error: 'Bad stash id' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('adbuilder_stash')
    .select('brief, script, preview_image_url')
    .eq('id', stashId)
    .single()
  if (error || !data) return Response.json({ error: 'Stash not found or expired' }, { status: 404 })
  return Response.json({ brief: data.brief, script: data.script, previewImage: data.preview_image_url })
}
