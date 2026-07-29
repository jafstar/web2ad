// Real alternative to uploading a photo for step 2a's character
// reference, requested live 2026-07-28: generate a reference image from
// a typed description, OR auto-write that description from the story's
// own beats first. Either path ends at the same generateCharacterImage
// call, so the result plugs into the exact same referenceImageDataUrl
// slot an uploaded photo would.
import { generateFlux } from '../engines/flux.js'
import { callGemini } from './models/gemini.js'
import { NO_TEXT_SUFFIX } from '../promptGuards.js'

const CHARACTER_DESC_SYSTEM = `You write a single, richly detailed physical description of the MAIN CHARACTER in this ad's story - for use as an image-generation prompt to create one reference portrait of them. Read the story beats below and infer who this person is (age range, build, real physical details, clothing, expression/demeanor) from what the story actually shows them doing - ground it in the story, don't invent unrelated details.

Output ONLY the description itself, one dense paragraph, 40-60 words, concrete and visual (real physical details a portrait artist could use) - nothing before or after, no markdown, no "Here is..." preamble.`

export async function describeCharacterFromStory(brief, beats) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
  const storyText = beats.map((b) => `${b.phrase} (${b.visual})`).join('\n')
  const prompt = `Business: ${brief.businessName} - ${brief.whatTheyDo}\n\nStory beats:\n${storyText}\n\nDescribe the main character now.`
  const raw = await callGemini(prompt, CHARACTER_DESC_SYSTEM, apiKey)
  return raw.trim()
}

export async function generateCharacterImage(description) {
  return generateFlux(
    `A real, photographic portrait of: ${description}. Grounded, natural lighting, neutral background, waist-up or headshot framing.${NO_TEXT_SUFFIX}`,
    1024, 1024
  )
}
