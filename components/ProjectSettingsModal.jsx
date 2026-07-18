'use client'

import React from 'react'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { VStack } from '@astryxdesign/core/VStack'
import { HStack } from '@astryxdesign/core/HStack'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Button } from '@astryxdesign/core/Button'

// Ported verbatim from designpipe-app/renderer/components/ProjectSettingsModal.jsx.
export default function ProjectSettingsModal({ isOpen, onOpenChange, project, onRename }) {
  const [name, setName] = React.useState(project?.name ?? '')

  React.useEffect(() => {
    if (isOpen) setName(project?.name ?? '')
  }, [isOpen, project?.name])

  const save = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== project?.name) onRename(trimmed)
    onOpenChange(false)
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={420}>
      <DialogHeader title="Project Settings" onOpenChange={onOpenChange} />
      <VStack gap={4}>
        <TextInput
          label="Project name"
          value={name}
          onChange={setName}
          placeholder="Untitled project"
        />
        <HStack gap={2} justify="end">
          <Button label="Cancel" variant="secondary" onClick={() => onOpenChange(false)} />
          <Button label="Save" variant="primary" className="dp-btn-green" onClick={save} isDisabled={!name.trim()} />
        </HStack>
      </VStack>
    </Dialog>
  )
}
