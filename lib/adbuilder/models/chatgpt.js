const MODEL = 'gpt-4o'

export async function callChatGPT(prompt, system, apiKey) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
  if (!res.ok) throw new Error(`ChatGPT API ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('ChatGPT returned an empty response')
  return content
}
