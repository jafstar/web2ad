import { createClient } from '../../../lib/supabase/server'
import { upscaleImage } from '../../../lib/engines/recraft'

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const { dataUrl, mode } = await request.json()
  if (!dataUrl) return Response.json({ error: 'dataUrl is required' }, { status: 400 })

  try {
    const upscaled = await upscaleImage(dataUrl, mode)
    return Response.json({ dataUrl: upscaled })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
