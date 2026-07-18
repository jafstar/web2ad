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

// Ported from designpipe-app/renderer/components/OverviewSection.jsx,
// re-added a real medium picker: Photos (upload/generate one reference,
// sweep variations) and Story (describe a subject, lock its identity,
// sweep it across a real scene sequence - the mechanism proven tonight in
// era-remix/walk-cycle/illustrated-classic testing, not just a single
// portrait grid).
const PROJECT_TYPES = [
  { key: 'photos', label: 'Photos', description: 'Upload or generate a reference, sweep variations across engines.' },
  { key: 'story', label: 'Story', description: 'Describe a subject once, lock its identity, generate it across a real scene sequence.' },
]

export default function OverviewSection({ onStartProject, onOpenProject }) {
  const { projects, loading, deleteProject } = useProjects()
  const [creating, setCreating] = React.useState(false)
  const [name, setName] = React.useState('')
  const [projectType, setProjectType] = React.useState('photos')
  const [error, setError] = React.useState(null)

  // Real bug, live-caught: onStartProject's rejection (e.g. the new
  // project-limit gate) went uncaught here - the form just closed with
  // zero feedback, no created project, no visible reason why.
  const submitCreate = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await onStartProject(name.trim() || 'Untitled', projectType)
      setCreating(false)
      setName('')
      setProjectType('photos')
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
          <Text type="label">Type</Text>
          <HStack gap={2}>
            {PROJECT_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                className={'dp-size-chip' + (projectType === t.key ? ' active' : '')}
                onClick={() => setProjectType(t.key)}
              >
                {t.label}
              </button>
            ))}
          </HStack>
          <Text type="supporting" color="secondary">{PROJECT_TYPES.find((t) => t.key === projectType)?.description}</Text>

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
                <Badge label={p.project_type || 'photos'} variant="neutral" />
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
