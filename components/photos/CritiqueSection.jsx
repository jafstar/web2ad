'use client'

import React from 'react'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { HStack } from '@astryxdesign/core/HStack'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Banner } from '@astryxdesign/core/Banner'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { Tooltip } from '@astryxdesign/core/Tooltip'
import { MessageSquareText, ChevronDown, ChevronRight, Info } from 'lucide-react'
import InfoBubble from '../InfoBubble'
import { useImageGeneration } from '../../lib/useImageGeneration'
import { groupRounds, roundTimeLabel } from '../../lib/rounds'
import RoundThumbGrid from './RoundThumbGrid'

// Ported verbatim from designpipe-app/renderer/components/photos/CritiqueSection.jsx
// — the round-open-jank fix and cross-project-bleed fix both carry over
// for free, same as useProjects.js's stale-closure guard.
export default function CritiqueSection({ project, saveData }) {
  const { progress, results, busy, error, generationProjectId } = useImageGeneration()
  const savedBatchRef = React.useRef(null)
  const gallery = project?.data?.gallery ?? []

  const isThisProjectsBatch = !!project && generationProjectId === project.id
  const busyHere = busy && isThisProjectsBatch

  React.useEffect(() => {
    if (busy || results.length === 0 || !isThisProjectsBatch) return
    if (savedBatchRef.current === results) return
    savedBatchRef.current = results
    const existing = project?.data?.gallery ?? []
    const newOnes = results.filter((r) => !existing.some((g) => g.id === r.id))
    if (newOnes.length > 0) {
      const nextRound = existing.reduce((max, g) => Math.max(max, g.round ?? 1), 0) + 1
      const generatedAt = Date.now()
      const stamped = newOnes.map((r) => ({ ...r, round: nextRound, generatedAt }))
      saveData({ ...project.data, gallery: [...existing, ...stamped] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, results, isThisProjectsBatch])

  const rounds = React.useMemo(() => groupRounds(gallery), [gallery])

  const favoriteIdsArr = project?.data?.favoriteIds ?? []
  const favoriteIds = React.useMemo(() => new Set(favoriteIdsArr), [favoriteIdsArr])
  const toggleFavorite = (item) => {
    const current = project?.data?.favoriteIds ?? []
    const next = current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]
    saveData({ ...project.data, favoriteIds: next })
  }

  const [openRounds, setOpenRounds] = React.useState(() => new Set())
  const seenRoundsRef = React.useRef(null)
  const manuallySetRef = React.useRef(new Set())
  const autoOpenRoundRef = React.useRef(null)
  React.useEffect(() => {
    if (rounds.length === 0) return
    if (seenRoundsRef.current === null) {
      seenRoundsRef.current = new Set(rounds.map((r) => r.round))
      autoOpenRoundRef.current = rounds[0].round
      setOpenRounds(new Set([rounds[0].round]))
      return
    }
    const newRounds = rounds.filter((r) => !seenRoundsRef.current.has(r.round))
    if (newRounds.length > 0) {
      for (const r of newRounds) seenRoundsRef.current.add(r.round)
      setOpenRounds((prev) => {
        const next = new Set(prev)
        if (autoOpenRoundRef.current !== null && !manuallySetRef.current.has(autoOpenRoundRef.current)) {
          next.delete(autoOpenRoundRef.current)
        }
        for (const r of newRounds) next.add(r.round)
        return next
      })
      autoOpenRoundRef.current = newRounds[0].round
    }
  }, [rounds])

  const setRoundOpen = (round, isOpen) => {
    manuallySetRef.current.add(round)
    setOpenRounds((prev) => {
      const next = new Set(prev)
      if (isOpen) next.add(round)
      else next.delete(round)
      return next
    })
  }

  return (
    <VStack gap={4}>
      <HStack gap={1} align="center">
        <Heading level={2} type="display-3" color="secondary">Critique</Heading>
        <InfoBubble tooltip="Compare what's been generated, live as it arrives, and heart the ones worth keeping." />
      </HStack>

      {busyHere && (
        <VStack gap={2}>
          <Text type="label">Generating {progress?.done ?? 0}/{progress?.total ?? 0}…</Text>
          <RoundThumbGrid items={results} ghostCount={Math.max(0, (progress?.total ?? 0) - results.length)} />
        </VStack>
      )}

      {error && isThisProjectsBatch && (
        <Banner status="error" title="Generation had an error" description={error} isDismissable />
      )}

      {!busyHere && gallery.length === 0 && (
        <EmptyState
          title="Nothing generated yet"
          description="Add a photo and generate variations in Intake — you'll watch them land here live."
          icon={<MessageSquareText size={28} />}
        />
      )}

      {!busyHere && rounds.length > 0 && (
        <VStack gap={2}>
          {rounds.map((r) => {
            const isOpen = openRounds.has(r.round)
            return (
              <Collapsible
                key={r.round}
                isOpen={isOpen}
                onOpenChange={(next) => setRoundOpen(r.round, next)}
                className="dp-round-box"
                trigger={
                  <HStack gap={2} align="center">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <Text type="label">
                      Round {r.round} — {r.items.length} image{r.items.length === 1 ? '' : 's'}
                      {r.generatedAt ? ` — ${roundTimeLabel(r.generatedAt)}` : ''}
                    </Text>
                    {r.items[0]?.prompt && (
                      <Tooltip content={r.items[0].prompt}>
                        <Info size={13} />
                      </Tooltip>
                    )}
                  </HStack>
                }
              >
                <RoundThumbGrid items={r.items} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} />
              </Collapsible>
            )
          })}
          <Text type="supporting" color="secondary">Heart the ones you want to keep — they'll show up in Lightbox.</Text>
        </VStack>
      )}
    </VStack>
  )
}
