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
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Banner } from '@astryxdesign/core/Banner'
import { Download } from 'lucide-react'
import { useRecraftKey } from '../../lib/useImageGeneration'
import { groupRounds, roundTimeLabel } from '../../lib/rounds'
import { sectionAtom } from '../../lib/atoms'
import { engineToLabel } from '../../lib/engines'
import { resolveDataUrl } from '../../lib/imageLibrary'
import InfoBubble from '../InfoBubble'

const MODES = [
  { key: 'all', label: 'All' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'rounds', label: 'Rounds' },
]

// Ported from designpipe-app/renderer/components/photos/ExportSection.jsx
// — one real, necessary change: the success message referenced
// res.folderPath (a native Save-dialog concept). The ipc shim's
// exportBatch triggers real browser downloads instead, which have no
// folder-path concept at all, so the message reflects that instead.
export default function ExportSection({ project }) {
  const recraft = useRecraftKey()
  const setSection = useSetAtom(sectionAtom)
  const gallery = project?.data?.gallery ?? []
  const favoriteIds = project?.data?.favoriteIds ?? []
  const rounds = React.useMemo(() => groupRounds(gallery), [gallery])
  const favoritedItems = React.useMemo(
    () => gallery.filter((item) => favoriteIds.includes(item.id)),
    [gallery, favoriteIds]
  )

  const [mode, setMode] = React.useState('all')

  const [selectedFavoriteIds, setSelectedFavoriteIds] = React.useState(() => new Set(favoritedItems.map((i) => i.id)))
  const [selectedRounds, setSelectedRounds] = React.useState(() => new Set(rounds.map((r) => r.round)))

  React.useEffect(() => {
    setSelectedFavoriteIds(new Set(favoritedItems.map((i) => i.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoritedItems.length])

  React.useEffect(() => {
    setSelectedRounds(new Set(rounds.map((r) => r.round)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds.length])

  const [upscaleMode, setUpscaleMode] = React.useState('crisp')
  const [busy, setBusy] = React.useState(false)
  const [exportStatus, setExportStatus] = React.useState(null)
  const [error, setError] = React.useState(null)

  const toggleFavoriteId = (id) => {
    setSelectedFavoriteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleRound = (round) => {
    setSelectedRounds((prev) => {
      const next = new Set(prev)
      if (next.has(round)) next.delete(round)
      else next.add(round)
      return next
    })
  }

  const chosenItems = mode === 'all'
    ? gallery
    : mode === 'rounds'
      ? gallery.filter((item) => selectedRounds.has(item.round))
      : favoritedItems.filter((item) => selectedFavoriteIds.has(item.id))

  const allFavoritesSelected = favoritedItems.length > 0 && selectedFavoriteIds.size === favoritedItems.length
  const allRoundsSelected = rounds.length > 0 && selectedRounds.size === rounds.length

  const toggleSelectAll = () => {
    if (mode === 'rounds') {
      setSelectedRounds(allRoundsSelected ? new Set() : new Set(rounds.map((r) => r.round)))
    } else {
      setSelectedFavoriteIds(allFavoritesSelected ? new Set() : new Set(favoritedItems.map((i) => i.id)))
    }
  }

  const runExport = async () => {
    if (chosenItems.length === 0) return
    setBusy(true)
    setError(null)
    setExportStatus(null)
    try {
      const images = []
      for (const item of chosenItems) {
        const raw = await resolveDataUrl(item)
        const dataUrl = upscaleMode === 'none' ? raw : await window.ipc.invoke('images:upscale', raw, upscaleMode)
        images.push({ dataUrl, filename: `${project.name}-r${item.round}-${item.engine}-${item.id.slice(-6)}.png` })
      }
      const res = await window.ipc.invoke('images:exportBatch', images)
      setExportStatus(res.saved ? `Downloaded ${res.count} image${res.count === 1 ? '' : 's'}` : null)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (gallery.length === 0) {
    return (
      <VStack gap={4}>
        <HStack gap={1} align="center">
          <Heading level={2} type="display-3" color="secondary">Export</Heading>
          <InfoBubble tooltip="Download the finished versions." />
        </HStack>
        <EmptyState title="Nothing to export yet" description="Generate something in Intake first." icon={<Download size={28} />} />
      </VStack>
    )
  }

  return (
    <VStack gap={4}>
      <HStack gap={1} align="center">
        <Heading level={2} type="display-3" color="secondary">Export</Heading>
        <InfoBubble tooltip="Pick what to export, upscale it faithfully, and save the real files." />
      </HStack>

      <div className="dp-export-narrow">
        <Card padding={5}>
          <VStack gap={4}>
            <VStack gap={2}>
              <Text type="label">Step 1 — What to export</Text>
              <HStack gap={2}>
                {MODES.map((m) => (
                  <button key={m.key} className={'dp-size-chip' + (mode === m.key ? ' active' : '')} onClick={() => setMode(m.key)}>{m.label}</button>
                ))}
              </HStack>
            </VStack>

            <Divider />

            <VStack gap={2}>
              <HStack justify="between" align="center">
                <Text type="label">Step 2 — Pick which</Text>
                {mode !== 'all' && (
                  <Button
                    label={(mode === 'rounds' ? allRoundsSelected : allFavoritesSelected) ? 'Deselect All' : 'Select All'}
                    variant="secondary"
                    size="sm"
                    onClick={toggleSelectAll}
                  />
                )}
              </HStack>

              {mode === 'all' && (
                <Text type="body" color="secondary">
                  {gallery.length} image{gallery.length === 1 ? '' : 's'} across {rounds.length} round{rounds.length === 1 ? '' : 's'} — everything gets exported.
                </Text>
              )}

              {mode === 'favorites' && favoritedItems.length === 0 && (
                <EmptyState title="No favorites yet" description="Heart images in Critique or Lightbox first." icon={<Download size={28} />} />
              )}

              {mode === 'favorites' && favoritedItems.length > 0 && (
                <VStack gap={2}>
                  {favoritedItems.map((item) => (
                    <label key={item.id} className="dp-round-checkbox-row">
                      <input type="checkbox" checked={selectedFavoriteIds.has(item.id)} onChange={() => toggleFavoriteId(item.id)} />
                      <Text type="body">{engineToLabel(item.engine)} Rd. {item.round}</Text>
                    </label>
                  ))}
                </VStack>
              )}

              {mode === 'rounds' && (
                <VStack gap={2}>
                  {rounds.map((r) => (
                    <label key={r.round} className="dp-round-checkbox-row">
                      <input type="checkbox" checked={selectedRounds.has(r.round)} onChange={() => toggleRound(r.round)} />
                      <Text type="body">
                        Round {r.round} — {r.items.length} image{r.items.length === 1 ? '' : 's'}
                        {r.generatedAt ? ` — ${roundTimeLabel(r.generatedAt)}` : ''}
                      </Text>
                    </label>
                  ))}
                </VStack>
              )}
            </VStack>

            <Divider />

            <VStack gap={3}>
              <HStack gap={1} align="center">
                <Text type="label">Step 3 — Upscale & export</Text>
                <InfoBubble tooltip="Powered by Recraft. Crisp: fast, cheap, sharper. Creative: slower, pricier, richer detail. Both enlarge the exact image rather than regenerating it. None exports the image as-is." />
              </HStack>
              <HStack gap={2}>
                <button className={'dp-size-chip' + (upscaleMode === 'none' ? ' active' : '')} onClick={() => setUpscaleMode('none')}>None</button>
                <button className={'dp-size-chip' + (upscaleMode === 'crisp' ? ' active' : '')} onClick={() => setUpscaleMode('crisp')}>Crisp</button>
                <button className={'dp-size-chip' + (upscaleMode === 'creative' ? ' active' : '')} onClick={() => setUpscaleMode('creative')}>Creative</button>
              </HStack>

              {upscaleMode !== 'none' && !recraft.key ? (
                <HStack gap={2} align="center">
                  <Text type="supporting" color="secondary">Add a Recraft key to upscale on export.</Text>
                  <Button label="Go to Settings" variant="secondary" size="sm" onClick={() => setSection('settings')} />
                </HStack>
              ) : (
                <Button
                  label={busy ? 'Exporting…' : `Export Selected (${chosenItems.length})`}
                  variant="secondary"
                  size="lg"
                  className="dp-export-btn"
                  isDisabled={busy || chosenItems.length === 0}
                  onClick={runExport}
                />
              )}

              {error && <Banner status="error" title="Export had an error" description={error} isDismissable />}
              {exportStatus && <Text type="supporting" color="secondary">{exportStatus}</Text>}
            </VStack>
          </VStack>
        </Card>
      </div>
    </VStack>
  )
}
