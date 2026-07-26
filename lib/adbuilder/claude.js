// Raw-fetch Claude text calls, same pattern already established in
// lib/vision.js (describeWithClaude) - no @anthropic-ai/sdk dependency
// needed, this codebase already does Claude via plain fetch.
async function fetchTimeout(url, opts, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)
  try { return await fetch(url, { ...opts, signal: controller.signal }) }
  finally { clearTimeout(timer) }
}

export async function callClaude(prompt, system, maxTokens = 1200) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  const res = await fetchTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  }, 45000)
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const text = data.content?.find((b) => b.type === 'text')?.text?.trim()
  if (!text) throw new Error('Claude returned no text')
  return text
}

// Real, live-caught pattern reused from lib/vision.js's parseJsonObject:
// "output ONLY JSON" doesn't always hold - find the first {...} substring
// rather than trusting the whole response is bare JSON.
export function parseJsonObject(text) {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`Expected JSON object, got: ${stripped.slice(0, 200)}`)
  return JSON.parse(match[0])
}
