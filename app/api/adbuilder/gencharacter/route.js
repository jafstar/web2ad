import { describeCharacterFromStory, generateCharacterImage } from '../../../../lib/adbuilder/characterRef.js'

// Step 2a's character reference, second path: render from a typed
// description, or auto-write that description from the story's own
// beats first if none was given. Free tier, no auth, same as the rest
// of 2a.
export const maxDuration = 60

export async function POST(req) {
  try {
    const { brief, beats, description } = await req.json()
    let finalDescription = description?.trim()
    if (!finalDescription) {
      if (!brief?.businessName || !beats?.length) return Response.json({ error: 'Missing brief/beats to describe a character from' }, { status: 400 })
      finalDescription = await describeCharacterFromStory(brief, beats)
    }
    const imageDataUrl = await generateCharacterImage(finalDescription)
    return Response.json({ description: finalDescription, imageDataUrl })
  } catch (e) {
    console.error('adbuilder/gencharacter failed:', e)
    return Response.json({ error: e.message || 'Could not generate a character reference' }, { status: 500 })
  }
}
