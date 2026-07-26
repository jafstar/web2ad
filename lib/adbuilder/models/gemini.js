// Real text-generation Gemini caller for the Council pipeline - separate
// from lib/engines/gemini.js which is image-only. Same proven pattern as
// story-glue's lib/models/gemini.js.
const MODEL = 'gemini-2.5-flash'

export async function callGemini(prompt, system, apiKey) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: system }] },
    }),
  })
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts
  if (!parts) throw new Error('Gemini returned no content')
  return parts.map((p) => p.text || '').join('')
}
