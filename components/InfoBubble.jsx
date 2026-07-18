'use client'

import { IconButton } from '@astryxdesign/core/IconButton'
import { Info } from 'lucide-react'

// Ported verbatim from designpipe-app/renderer/components/InfoBubble.jsx.
export default function InfoBubble({ tooltip, onClick }) {
  return <IconButton label="More info" icon={<Info size={13} />} variant="ghost" size="sm" tooltip={tooltip} onClick={onClick} />
}
