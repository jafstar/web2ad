// Real, live-validated 2026-07-25 test (see the ad-story Council trial
// against Just Chicken) - Grok as the Jester critique voice, explicitly
// hunting for real jokes/surprise rather than generic "add humor."
const MODEL = 'grok-4'

export async function callGrok(prompt, system, apiKey) {
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Grok API ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Grok returned an empty response')
  return content
}
