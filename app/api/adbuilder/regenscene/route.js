import { generateKeyframeFor } from '../../../../lib/adbuilder/shots.js'

// Free-tier per-scene regenerate, requested live 2026-07-28: "allow the
// human to iterate when auto gets it wrong" - until now, regenerating a
// single bad image only existed after paying (beatedit/keyframe), so a
// bad free-preview image forced starting the whole thing over. Same real
// Flux call as everywhere else, just scoped to one scene and free, no
// auth, no persistence - the client owns the resulting beats array
// itself, same as it already does for editing phrase/visual text in 2a.
export const maxDuration = 60

export async function POST(req) {
  try {
    const { brief, atmosphere, beatId, visual, fixNote, referenceImageDataUrl } = await req.json()
    if (!brief?.businessName || !visual) return Response.json({ error: 'Missing brief or visual' }, { status: 400 })

    const previewRunId = `storyboard-regen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const { url } = await generateKeyframeFor(previewRunId, beatId || 1, visual, brief, atmosphere, fixNote || '', referenceImageDataUrl || null)
    return Response.json({ keyframeUrl: url })
  } catch (e) {
    console.error('adbuilder/regenscene failed:', e)
    return Response.json({ error: e.message || 'Could not regenerate that scene' }, { status: 500 })
  }
}
