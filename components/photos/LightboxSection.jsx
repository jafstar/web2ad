'use client'

import React from 'react'
import { useSetAtom } from 'jotai'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { HStack } from '@astryxdesign/core/HStack'
import { IconButton } from '@astryxdesign/core/IconButton'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heart, Reply } from 'lucide-react'
import InfoBubble from '../InfoBubble'
import { sectionAtom } from '../../lib/atoms'
import { engineToLabel } from '../../lib/engines'
import { imageSrc, resolveDataUrl } from '../../lib/imageLibrary'

// Ported verbatim from designpipe-app/renderer/components/photos/LightboxSection.jsx.
export default function LightboxSection({ project, saveData }) {
  const setSection = useSetAtom(sectionAtom)
  const gallery = project?.data?.gallery ?? []
  const favoriteIds = project?.data?.favoriteIds ?? []
  const favorited = React.useMemo(
    () => gallery.filter((item) => favoriteIds.includes(item.id)),
    [gallery, favoriteIds]
  )

  const [dims, setDims] = React.useState({})

  const removeFavorite = (item) => {
    saveData({ ...project.data, favoriteIds: favoriteIds.filter((id) => id !== item.id) })
  }

  const sendToIntake = async (item) => {
    const dataUrl = await resolveDataUrl(item)
    const { photo: _old, analyzedPhotoName: _a, presets: _p, ...rest } = project.data
    saveData({ ...rest, photo: { name: `${item.engine}-round${item.round}.png`, dataUrl } })
    setSection('intake')
  }

  if (favorited.length === 0) {
    return (
      <VStack gap={4}>
        <HStack gap={1} align="center">
          <Heading level={2} type="display-3" color="secondary">Lightbox</Heading>
          <InfoBubble tooltip="Images you've hearted from Critique." />
        </HStack>
        <EmptyState
          title="Nothing hearted yet"
          description="Heart images in Critique to bring them here."
          icon={<Heart size={28} />}
        />
      </VStack>
    )
  }

  return (
    <VStack gap={4}>
      <HStack gap={1} align="center">
        <Heading level={2} type="display-3" color="secondary">Lightbox</Heading>
        <InfoBubble tooltip={`Images you've hearted from Critique — ${favorited.length} saved.`} />
      </HStack>

      <div className="dp-lightbox-flat-grid">
        {favorited.map((item) => {
          const d = dims[item.id]
          return (
            <div key={item.id} className="dp-lightbox-flat-item">
              <div className="dp-lightbox-flat-imgwrap">
                <img
                  src={imageSrc(item)}
                  alt={item.prompt}
                  draggable="false"
                  onLoad={(e) => setDims((prev) => ({ ...prev, [item.id]: { width: e.target.naturalWidth, height: e.target.naturalHeight } }))}
                />
              </div>
              <HStack justify="between" align="center">
                <VStack gap={0}>
                  <Text type="supporting">{engineToLabel(item.engine)} Rd. {item.round}</Text>
                  {d && <Text type="supporting" color="secondary">{d.width}×{d.height}</Text>}
                </VStack>
                <HStack gap={1}>
                  <IconButton label="Send to Intake" icon={<Reply size={14} />} variant="ghost" size="sm" tooltip="Use as reference in Intake" onClick={() => sendToIntake(item)} />
                  <IconButton label="Remove from Lightbox" icon={<Heart size={14} fill="currentColor" />} variant="ghost" size="sm" tooltip="Remove from Lightbox" onClick={() => removeFavorite(item)} />
                </HStack>
              </HStack>
            </div>
          )
        })}
      </div>
    </VStack>
  )
}
