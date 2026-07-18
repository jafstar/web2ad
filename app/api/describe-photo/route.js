import { createClient } from '../../../lib/supabase/server'
import { describePhoto } from '../../../lib/vision'

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const { dataUrl } = await request.json()
  if (!dataUrl) return Response.json({ error: 'dataUrl is required' }, { status: 400 })

  // Claude's vision API hard-caps images at ~5MB base64 (and separately
  // at 8000px per side) — a full-resolution desktop screenshot uploaded
  // as PNG (lossless, much bigger than an equivalent JPEG photo) can
  // exceed that easily. Checked here with a clear message instead of
  // letting it surface as an opaque Claude API error.
  const approxBytes = dataUrl.length * 0.75
  if (approxBytes > 4.5 * 1024 * 1024) {
    return Response.json({ error: 'Image too large for vision analysis (~5MB limit) — try a smaller photo or a JPEG instead of a full-resolution PNG screenshot.' }, { status: 400 })
  }

  try {
    const presets = await describePhoto(dataUrl)
    return Response.json({ presets })
  } catch (e) {
    console.error('describe-photo failed:', e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
