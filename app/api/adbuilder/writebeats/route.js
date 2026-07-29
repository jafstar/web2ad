import { writeAdBeats } from '../../../../lib/adbuilder/beatPipeline.js'

// Step 2a, part 2: expands the chosen theme into a real full beat
// sequence - still cheap/text-only, no images/audio. The chosen theme's
// title+pitch is passed as `direction` (the same free-text creative-
// steer mechanism writeAdBeats already has), combined with anything the
// business owner typed on step 1, so both apply together. Returns
// editable beats - the business owner can revise phrase/visual text
// here before step 2b spends anything on images/audio.
export const maxDuration = 30

export async function POST(req) {
  try {
    const { brief, direction, tone } = await req.json()
    if (!brief?.businessName || !brief?.whatTheyDo) return Response.json({ error: 'Missing brief' }, { status: 400 })
    const { beats, atmosphere } = await writeAdBeats(brief, direction, tone)
    return Response.json({ beats, atmosphere })
  } catch (e) {
    console.error('adbuilder/writebeats failed:', e)
    return Response.json({ error: e.message || 'Could not write the script' }, { status: 500 })
  }
}
