'use client'

import { Badge } from '@astryxdesign/core/Badge'

// Ported verbatim from designpipe-app/renderer/components/PoweredByBadge.jsx.
export const PROVIDERS = {
  bfl: { label: 'Flux', variant: 'orange' },
  recraft: { label: 'Recraft', variant: 'purple' },
  claude: { label: 'Claude', variant: 'blue' },
  gemini: { label: 'Gemini', variant: 'teal' },
}

export default function PoweredByBadge({ provider, plain = false }) {
  const p = PROVIDERS[provider]
  if (!p) return null
  return <Badge label={plain ? p.label : `Powered by ${p.label}`} variant={p.variant} />
}
