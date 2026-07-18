// Ported verbatim from designpipe-app/renderer/lib/rounds.js.
export function groupRounds(gallery) {
  const byRound = new Map()
  for (const item of gallery) {
    const round = item.round ?? 1
    if (!byRound.has(round)) byRound.set(round, { round, items: [], generatedAt: item.generatedAt })
    byRound.get(round).items.push(item)
  }
  return [...byRound.values()].sort((a, b) => b.round - a.round)
}

export function roundTimeLabel(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
