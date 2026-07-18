'use client'

import React from 'react'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Lightbox } from '@astryxdesign/core/Lightbox'
import { Heart } from 'lucide-react'
import PoweredByBadge from '../PoweredByBadge'
import { engineToProvider } from '../../lib/engines'
import { imageSrc } from '../../lib/imageLibrary'

// Ported verbatim from designpipe-app/renderer/components/photos/RoundThumbGrid.jsx,
// plus two real additions: clicking a thumbnail opens it in Astryx's Lightbox
// (gallery mode - prev/next across the whole round, zoom on double-click), and
// `ghostCount` renders skeleton placeholders for images still in flight so a
// generating batch doesn't read as a blank grid slowly filling in.
export default function RoundThumbGrid({ items, favoriteIds, onToggleFavorite, ghostCount = 0 }) {
  const [dims, setDims] = React.useState({})
  const [openIndex, setOpenIndex] = React.useState(null)

  return (
    <div className="dp-thumb-grid">
      {items.map((r, i) => {
        const d = dims[r.id]
        const isFavorited = favoriteIds?.has(r.id)
        return (
          <div key={r.id} className="dp-thumb-wrap">
            <img
              src={imageSrc(r)}
              alt={r.prompt}
              className="dp-thumb-img"
              draggable="false"
              style={{ cursor: 'pointer' }}
              onClick={() => setOpenIndex(i)}
              onLoad={(e) => setDims((prev) => ({ ...prev, [r.id]: { width: e.target.naturalWidth, height: e.target.naturalHeight } }))}
            />
            <HStack gap={1} align="center" justify="between" className="dp-thumb-footer">
              <HStack gap={1} align="center">
                <PoweredByBadge provider={engineToProvider(r.engine)} plain />
                {d && <Text type="supporting" color="secondary">{d.width}×{d.height}</Text>}
              </HStack>
              {onToggleFavorite && (
                <IconButton
                  label={isFavorited ? 'Remove from Lightbox' : 'Save to Lightbox'}
                  icon={<Heart size={14} fill={isFavorited ? 'currentColor' : 'none'} />}
                  variant={isFavorited ? 'secondary' : 'ghost'}
                  size="sm"
                  tooltip={isFavorited ? 'Saved to Lightbox' : 'Save to Lightbox'}
                  onClick={() => onToggleFavorite(r)}
                />
              )}
            </HStack>
          </div>
        )
      })}
      {Array.from({ length: Math.max(0, ghostCount) }, (_, i) => (
        <div key={`ghost-${i}`} className="dp-thumb-wrap dp-thumb-ghost" aria-hidden="true">
          <div className="dp-thumb-ghost-img" />
          <div className="dp-thumb-ghost-footer" />
        </div>
      ))}
      <Lightbox
        isOpen={openIndex !== null}
        onOpenChange={(open) => { if (!open) setOpenIndex(null) }}
        media={items.map((r) => ({ src: imageSrc(r), alt: r.prompt || '' }))}
        index={openIndex ?? 0}
        onIndexChange={setOpenIndex}
        hasZoom
        // Real bug in Lightbox's own backdrop-click detection: the dialog
        // is stretched to 100vw/100vh and its content wrapper is ALSO
        // stretched to 100%/100% to center the image, so the library's own
        // `e.target === dialog` check never fires - that wrapper always
        // intercepts first, everywhere. Detecting it ourselves instead:
        // anything that isn't the image itself or a control closes it.
        onClick={(e) => {
          if (e.target.tagName !== 'IMG' && !e.target.closest('button')) setOpenIndex(null)
        }}
      />
    </div>
  )
}
