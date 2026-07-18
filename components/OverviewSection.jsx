'use client'

import React from 'react'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { HStack } from '@astryxdesign/core/HStack'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { Badge } from '@astryxdesign/core/Badge'
import { Image as ImageIcon } from 'lucide-react'
import { useProjects } from '../lib/useProjects'
import InfoBubble from './InfoBubble'

// Simplified from designpipe-app/renderer/components/OverviewSection.jsx
// — genstock is Photos-only (no Web/Print/Voice pipelines), so this
// skips straight to project creation instead of a medium picker.
export default function OverviewSection({ onStartProject, onOpenProject }) {
  const { projects, loading, deleteProject } = useProjects()
  const [creating, setCreating] = React.useState(false)
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState(null)

  // Real bug, live-caught: onStartProject's rejection (e.g. the new
  // project-limit gate) went uncaught here - the form just closed with
  // zero feedback, no created project, no visible reason why.
  const submitCreate = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await onStartProject(name.trim() || 'Untitled', 'photos')
      setCreating(false)
      setName('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <VStack gap={5}>
      <HStack gap={1} align="center">
        <Heading level={2} type="display-3" color="secondary">Projects</Heading>
        <InfoBubble tooltip="Each project gets its own scoped, saved generation history." />
      </HStack>

      {!creating ? (
        <button type="button" className="btn btn-primary dp-btn-green" onClick={() => setCreating(true)} style={{ width: 'fit-content' }}>
          New project
        </button>
      ) : (
        <form onSubmit={submitCreate} className="dp-name-form">
          <Text type="label">Name your project</Text>
          <HStack gap={2}>
            <input
              autoFocus
              className="dp-mood-select"
              style={{ flex: 1 }}
              placeholder="Untitled"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="btn btn-primary dp-btn-green">Create</button>
          </HStack>
        </form>
      )}
      {error && <Text type="supporting" style={{ color: '#e05252' }}>{error}</Text>}

      <VStack gap={2}>
        <Text type="label">Recent Projects</Text>
        {loading && <Text type="supporting" color="secondary">Loading…</Text>}
        {!loading && projects.length === 0 && <Text type="supporting" color="secondary">No projects yet — start one above.</Text>}
        {projects.map((p) => (
          <ClickableCard key={p.id} label={`Open ${p.name}`} onClick={() => onOpenProject(p)} padding={3}>
            <HStack gap={2} align="center" justify="between">
              <HStack gap={2} align="center">
                <Badge label="photos" variant="neutral" />
                <ImageIcon size={16} />
                <Text type="body">{p.name}</Text>
              </HStack>
              <button
                className="dp-delete-btn"
                onClick={(e) => { e.stopPropagation(); deleteProject(p.id) }}
                aria-label={`Delete ${p.name}`}
              >
                ✕
              </button>
            </HStack>
          </ClickableCard>
        ))}
      </VStack>
    </VStack>
  )
}
