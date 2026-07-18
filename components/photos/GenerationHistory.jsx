'use client'

import React from 'react'
import { useSetAtom } from 'jotai'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { HStack } from '@astryxdesign/core/HStack'
import { Card } from '@astryxdesign/core/Card'
import { Button } from '@astryxdesign/core/Button'
import { Divider } from '@astryxdesign/core/Divider'
import { groupRounds, roundTimeLabel } from '../../lib/rounds'
import { sectionAtom } from '../../lib/atoms'

// Ported verbatim from designpipe-app/renderer/components/photos/GenerationHistory.jsx.
export default function GenerationHistory({ project }) {
  const gallery = project?.data?.gallery ?? []
  const rounds = React.useMemo(() => groupRounds(gallery), [gallery])
  const setSection = useSetAtom(sectionAtom)
  if (rounds.length === 0) return null

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack justify="between" align="center">
          <Heading level={4}>History</Heading>
          <Button label="View All" variant="secondary" size="sm" onClick={() => setSection('critique')} />
        </HStack>
        <Divider />
        <VStack gap={2}>
          {rounds.map((r) => (
            <HStack key={r.round} justify="between" align="center">
              <Text type="body">Round {r.round}</Text>
              <Text type="supporting" color="secondary">
                {r.items.length} image{r.items.length === 1 ? '' : 's'}
                {r.generatedAt ? ` — ${roundTimeLabel(r.generatedAt)}` : ''}
              </Text>
            </HStack>
          ))}
        </VStack>
      </VStack>
    </Card>
  )
}
