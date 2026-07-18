'use client'

import React from 'react'
import { useSetAtom } from 'jotai'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { HStack } from '@astryxdesign/core/HStack'
import { Card } from '@astryxdesign/core/Card'
import { Button } from '@astryxdesign/core/Button'
import { useImageGeneration } from '../../lib/useImageGeneration'
import { useCreditsCheck } from '../../lib/useCredits'
import { sectionAtom } from '../../lib/atoms'
import InfoBubble from '../InfoBubble'

// Story type's real mechanism, proven tonight across era-remix/walk-
// cycle/illustrated-classic testing: describe a subject once (text, not
// an uploaded photo - the "character builder, not face upload" idea),
// lock its identity, then generate it across a real scene sequence
// instead of a flat variation grid. Reuses Photos' Critique/Lightbox/
// Export unchanged - generateStory() shares the exact same result atoms
// generate() does, so the existing round-saving effect just works.
export default function StorySection({ project, saveData }) {
  const { generateStory, busy, generationProjectId } = useImageGeneration()
  const setSection = useSetAtom(sectionAtom)
  const busyHere = busy && generationProjectId === project?.id

  const [description, setDescription] = React.useState('')
  const [generatingRef, setGeneratingRef] = React.useState(false)
  const [refError, setRefError] = React.useState(null)
  const [scenesText, setScenesText] = React.useState('')

  const photo = project?.data?.photo ?? null

  const handleGenerateReference = async () => {
    if (!description.trim()) return
    setGeneratingRef(true)
    setRefError(null)
    try {
      const dataUrl = await window.ipc.invoke('images:generateReference', description.trim())
      await saveData({ ...project.data, photo: { name: 'character.png', dataUrl }, characterDescription: description.trim() })
    } catch (e) {
      setRefError(e.message)
    } finally {
      setGeneratingRef(false)
    }
  }

  const sceneList = scenesText.split('\n').map((s) => s.trim()).filter(Boolean)
  const credits = useCreditsCheck(sceneList.length)
  const outOfCredits = !credits.unlimited && !credits.ok

  const handleGenerateStory = () => {
    if (sceneList.length === 0 || outOfCredits) return
    generateStory({ referenceImageDataUrl: photo.dataUrl, scenes: sceneList, projectId: project.id })
    setSection('critique')
  }

  return (
    <VStack gap={4}>
      <HStack gap={1} align="center">
        <Heading level={2} type="display-3" color="secondary">Story</Heading>
        <InfoBubble tooltip="Describe a character once, lock its identity, then generate it across a real scene sequence." />
      </HStack>

      {!photo && (
        <Card padding={5}>
          <VStack gap={3} align="center">
            <Text type="body" color="secondary">Describe your character</Text>
            <textarea
              className="dp-mood-select"
              style={{ width: '100%', minHeight: 100, resize: 'vertical' }}
              placeholder="a young detective in a worn leather jacket, sharp eyes, short dark hair..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button
              label={generatingRef ? 'Generating…' : 'Generate Character'}
              variant="primary"
              className="dp-btn-green"
              isDisabled={generatingRef || !description.trim()}
              onClick={handleGenerateReference}
            />
            {refError && <Text type="supporting" style={{ color: '#e05252' }}>{refError}</Text>}
          </VStack>
        </Card>
      )}

      {photo && (
        <VStack gap={3}>
          <Card padding={4}>
            <HStack gap={4} align="start">
              <img src={photo.dataUrl} alt="Character" style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 8 }} />
              <VStack gap={1}>
                <Text type="label">Locked character</Text>
                <Text type="supporting" color="secondary">{project?.data?.characterDescription || photo.name}</Text>
              </VStack>
            </HStack>
          </Card>

          <Card padding={4}>
            <VStack gap={3}>
              <HStack gap={1} align="center">
                <Text type="label">Scenes</Text>
                <InfoBubble tooltip="One scene per line - each becomes one image, same locked identity, genuinely different setting/action each time." />
              </HStack>
              <textarea
                className="dp-mood-select"
                style={{ width: '100%', minHeight: 140, resize: 'vertical' }}
                placeholder={'sitting at a rain-streaked cafe window at night\nwalking down a foggy alley, coat collar up\nexamining a piece of evidence under a desk lamp'}
                value={scenesText}
                onChange={(e) => setScenesText(e.target.value)}
              />
              <Button
                label={
                  busyHere ? 'Generating… (see Critique)'
                    : outOfCredits ? 'Out of credits'
                    : `Generate ${sceneList.length} Scene${sceneList.length === 1 ? '' : 's'}`
                }
                variant="primary"
                className="dp-btn-blue"
                isDisabled={busy || sceneList.length === 0 || outOfCredits}
                onClick={handleGenerateStory}
              />
            </VStack>
          </Card>
        </VStack>
      )}
    </VStack>
  )
}
