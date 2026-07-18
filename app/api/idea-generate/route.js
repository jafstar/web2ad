import { createClient } from '../../../lib/supabase/server'
import { generateGemini } from '../../../lib/engines/gemini'
import { randomIdeaPrompt } from '../../../lib/ideaPrompts'

// The Idea page's one-button generator: no prompt input, no credits, no
// Cloudinary round-trip — picks a random subject from the curated pool and
// hands back a raw base64 dataUrl, same shape IntakeSection's own file
// upload produces, so it can seed a project's photo directly.
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })

    const prompt = randomIdeaPrompt()
    const dataUrl = await generateGemini(prompt)
    return Response.json({ dataUrl, prompt })
  } catch (e) {
    console.error('idea-generate failed:', e)
    return Response.json({ error: e.message || 'Generation failed' }, { status: 500 })
  }
}
