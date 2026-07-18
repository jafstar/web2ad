'use client'

import React from 'react'
import { useAtom } from 'jotai'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { HStack } from '@astryxdesign/core/HStack'
import { Card } from '@astryxdesign/core/Card'
import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Switch } from '@astryxdesign/core/Switch'
import { Pencil, RefreshCw, Lightbulb, ImagePlus } from 'lucide-react'
import { useGeminiKey } from '../../lib/useImageGeneration'
import { VARIATION_LABELS, VARIATION_DEFAULT_INDEX } from '../../lib/variationModes'
import { tagWordsClient } from '../../lib/wordTagsClient'
import { fx180Atom } from '../../lib/atoms'
import GenerateVariations from './GenerateVariations'
import GenerationHistory from './GenerationHistory'
import InfoBubble from '../InfoBubble'

const SAVE_DEBOUNCE_MS = 600
// Fx panel is real infrastructure (fx180Atom, frontBackHint, the
// per-engine front/back call paths in /api/generate) for a broader
// category of quick/known-shape gens - 180 Deg is the first one, with
// Flyover / Night Version / etc. as likely future additions to the same
// panel. Hidden until 180 Deg's own physical consistency (sun position
// across the pair) is solid enough across all three engines - Flux reads
// closest to correct, Recraft and Gemini still slip. Flip back on once
// that's resolved (or once Fx is deliberately scoped Flux-only).
const FX_PANEL_ENABLED = false
const MODE_KEYS = ['exact', 'similar', 'category']
const PARTS_COLUMNS = [
  { key: 'noun', label: 'Nouns' },
  { key: 'verb', label: 'Verbs' },
  { key: 'adjective', label: 'Adjectives' },
]
const PRIORITY_COLUMNS = [
  { key: 'focus', label: 'Focus' },
  { key: 'detail', label: 'Details' },
]

function reconstruct(tags, selectedSet) {
  return tags.filter((_, i) => selectedSet.has(i)).map((t) => t.text).join(' ')
}

// The real secret sauce: Description isn't a text box you type into, it's
// built from selectable word-tags — every word in whatever base text is
// active (Exact/Similar/Category, see below) gets classified two ways at
// once, entirely client-side (lib/wordTagsClient.js — compromise, a real
// NLP tagger, not an AI call — POS tagging doesn't need a model, and the
// earlier Gemini-based version was noticeably slow live): part of speech
// (the Parts tab: Noun/Verb/Adjective) and priority (the Priority tab —
// Focus/Detail, nouns are the subject matter, verbs/adjectives are
// supporting description). Same words, two different groupings, ONE
// shared selection state — toggling a word off in either tab removes it
// from the reconstructed Description everywhere. Priority is the default
// tab (2 columns reads easier at a glance than 3, and doesn't require
// knowing grammar terms) — the actual textarea is hidden by default (Raw
// toggle) since the tags ARE the real editing surface now.
//
// The Exact/Similar/Category select still picks which base text gets
// tagged in the first place — Exact has one reading of the photo;
// Similar/Category each need an explicit pick from 3 distinct AI-
// generated options (see the option cards below) since a single
// auto-generated version of each kept reading too close to the others.
export default function IntakeSection({ project, saveData }) {
  const inputRef = React.useRef(null)
  const [busy, setBusy] = React.useState(false)
  const [fx180, setFx180] = useAtom(fx180Atom)
  const gemini = useGeminiKey()
  const photo = project?.data?.photo ?? null
  const analyzedFor = project?.data?.analyzedPhotoName ?? null
  const descriptionOptions = project?.data?.descriptionOptions ?? null
  const variationIndex = Math.max(0, Math.min(2, project?.data?.variationIndex ?? VARIATION_DEFAULT_INDEX))
  const selectedSimilarIndex = project?.data?.selectedSimilarIndex ?? null
  const selectedCategoryIndex = project?.data?.selectedCategoryIndex ?? null
  const mode = MODE_KEYS[variationIndex]

  const wordTags = project?.data?.wordTags ?? null
  const selectedWordIndices = React.useMemo(
    () => new Set(project?.data?.selectedWordIndices ?? (wordTags ? wordTags.map((_, i) => i) : [])),
    [project?.data?.selectedWordIndices, wordTags]
  )

  const [description, setDescription] = React.useState(project?.data?.description ?? '')
  const [analyzing, setAnalyzing] = React.useState(false)
  const [switching, setSwitching] = React.useState(false)
  const [rawMode, setRawMode] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState('priority')
  const saveTimer = React.useRef(null)
  const descriptionRef = React.useRef(description)
  descriptionRef.current = description

  // Keep local text in sync when the underlying project data changes out
  // from under us (new project selected, or analysis/pick/tag-toggle
  // just wrote a value).
  React.useEffect(() => {
    setDescription(project?.data?.description ?? '')
  }, [project?.id, project?.data?.description])

  const persistDescription = React.useCallback((value) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveData({ ...project.data, description: value })
    }, SAVE_DEBOUNCE_MS)
  }, [project, saveData])

  const handleDescriptionChange = (value) => {
    setDescription(value)
    persistDescription(value)
  }

  // Tags a new base text (only if it isn't already what's tagged) and
  // seeds selection to "everything on" — matches the reconstructed text
  // to the base text exactly until the user starts deselecting. Client-
  // side and synchronous (compromise, no network) — returns the merged
  // data object rather than saving itself, so callers can fold it into
  // ONE saveData call instead of two sequential round trips. That
  // double-save (option pick, then a separate tag save) was the real
  // cause of the ~1.4s felt delay — now it's a single ~700ms round trip.
  const withTags = React.useCallback((baseData, text) => {
    if (!text?.trim() || text === baseData?.taggedText) return baseData
    const tags = tagWordsClient(text)
    return { ...baseData, wordTags: tags, selectedWordIndices: tags.map((_, i) => i), taggedText: text }
  }, [])

  const handleVariationChange = async (index) => {
    clearTimeout(saveTimer.current)
    let next = { ...project.data, variationIndex: index }
    const key = MODE_KEYS[index]
    let text = null
    if (key === 'exact' && descriptionOptions?.exact) text = descriptionOptions.exact
    else if (key === 'similar' && selectedSimilarIndex != null) text = descriptionOptions?.similar?.[selectedSimilarIndex] ?? null
    else if (key === 'category' && selectedCategoryIndex != null) text = descriptionOptions?.category?.[selectedCategoryIndex] ?? null
    // Similar/Category with no pick yet: leave description as-is until
    // the user picks a card below.
    if (text != null) {
      setDescription(text)
      next.description = text
      next = withTags(next, text)
    }
    setSwitching(true)
    try {
      await saveData(next)
    } finally {
      setSwitching(false)
    }
  }

  const handleOptionSelect = async (optMode, index) => {
    const text = descriptionOptions?.[optMode]?.[index]
    if (text == null) return
    clearTimeout(saveTimer.current)
    setDescription(text)
    const key = optMode === 'similar' ? 'selectedSimilarIndex' : 'selectedCategoryIndex'
    const next = withTags({ ...project.data, description: text, [key]: index }, text)
    setSwitching(true)
    try {
      await saveData(next)
    } finally {
      setSwitching(false)
    }
  }

  const toggleWord = (i) => {
    if (!wordTags) return
    const next = new Set(selectedWordIndices)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    const nextDescription = reconstruct(wordTags, next)
    setDescription(nextDescription)
    saveData({ ...project.data, selectedWordIndices: [...next].sort((a, b) => a - b), description: nextDescription })
  }

  // Shared by the automatic first-run effect below and the manual
  // Refresh button — `force` regenerates fresh options even if this
  // photo was already analyzed; an explicit refresh click means the
  // user wants it redone regardless.
  const runAnalysis = React.useCallback((force, isCancelled) => {
    if (!photo || !gemini.loaded) return Promise.resolve()
    setAnalyzing(true)
    return window.ipc.invoke('images:describePhoto', photo.dataUrl)
      .then(async (result) => {
        if (isCancelled()) return
        const options = result && typeof result === 'object' && !Array.isArray(result)
          ? result
          : { exact: '', similar: [], category: [] }
        const seeded = options.exact || descriptionRef.current
        setDescription(seeded)
        let next = {
          ...project.data,
          analyzedPhotoName: photo.name,
          descriptionOptions: options,
          description: seeded,
          variationIndex: VARIATION_DEFAULT_INDEX,
          selectedSimilarIndex: null,
          selectedCategoryIndex: null,
        }
        if (seeded) next = withTags(next, seeded)
        await saveData(next)
      })
      .catch(() => {
        if (!isCancelled()) saveData({ ...project.data, analyzedPhotoName: photo.name })
      })
      .finally(() => { if (!isCancelled()) setAnalyzing(false) })
  }, [photo, gemini.loaded, project, saveData, withTags])

  React.useEffect(() => {
    if (!photo || !gemini.loaded || analyzedFor === photo.name) return
    let cancelled = false
    runAnalysis(false, () => cancelled)
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.name, gemini.loaded, analyzedFor])

  const handleRefreshAnalysis = () => {
    if (analyzing) return
    runAnalysis(true, () => false)
  }

  const handleFile = (file) => {
    if (!file) return
    setBusy(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const {
        photo: _old, analyzedPhotoName: _a, presets: _p, description: _d,
        descriptionVariants: _v, descriptionOptions: _o, variationIndex: _i,
        selectedSimilarIndex: _s, selectedCategoryIndex: _c,
        wordTags: _w, taggedText: _t, selectedWordIndices: _sw, ...rest
      } = project.data
      setDescription('')
      await saveData({ ...rest, photo: { name: file.name, dataUrl: reader.result } })
      setBusy(false)
    }
    reader.readAsDataURL(file)
  }

  // No image in mind: skip the file picker entirely and seed the photo
  // with one cheap, randomly-picked Gemini generation instead - same
  // reset-stale-fields + saveData path as a real upload, so once it lands
  // the existing analysis effect picks it up unchanged and this whole
  // affordance just disappears (it's gated on !photo like Choose Photo is).
  const handleGenerateIdea = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/idea-generate', { method: 'POST' })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body) throw new Error(body?.error || `Generation failed (${res.status})`)
      const {
        photo: _old, analyzedPhotoName: _a, presets: _p, description: _d,
        descriptionVariants: _v, descriptionOptions: _o, variationIndex: _i,
        selectedSimilarIndex: _s, selectedCategoryIndex: _c,
        wordTags: _w, taggedText: _t, selectedWordIndices: _sw, ...rest
      } = project.data
      setDescription('')
      await saveData({ ...rest, photo: { name: 'idea.png', dataUrl: body.dataUrl } })
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  const currentOptions = mode !== 'exact' ? descriptionOptions?.[mode] : null
  const currentSelected = mode === 'similar' ? selectedSimilarIndex : mode === 'category' ? selectedCategoryIndex : null
  const tabColumns = activeTab === 'parts' ? PARTS_COLUMNS : PRIORITY_COLUMNS

  return (
    <div className="dp-intake-layout">
      <VStack gap={4} className="dp-intake-main">
        <HStack justify="between" align="center">
          <HStack gap={1} align="center">
            <Heading level={2} type="display-3" color="secondary">Intake</Heading>
            <InfoBubble tooltip="Bring in the photo this project is working from." />
          </HStack>

          {photo && (
            <HStack gap={1} align="center">
              <Text type="supporting" color="secondary">{photo.name}</Text>
              <IconButton
                label="Replace photo"
                icon={<Pencil size={13} />}
                variant="ghost"
                size="sm"
                tooltip="Replace photo"
                onClick={() => inputRef.current?.click()}
              />
            </HStack>
          )}
        </HStack>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        <Card padding={5} style={{ '--_card-radius': '0px' }}>
          {!photo && (
            <VStack gap={3} align="center" justify="center" minHeight={600}>
              <ImagePlus size={28} />
              <Text type="body" color="secondary">Upload an image</Text>
              <Button label={busy ? 'Loading…' : 'Choose Photo'} variant="primary" className="dp-btn-green" isDisabled={busy} onClick={() => inputRef.current?.click()} />
              <hr style={{ width: '100%', maxWidth: 360, border: 'none', borderTop: '1px solid rgba(255,255,255,0.18)' }} />
              <VStack gap={2} align="center">
                <HStack gap={1} align="center">
                  <Lightbulb size={13} />
                  <Text type="supporting" color="secondary">Don't have an image?</Text>
                </HStack>
                <Button label={busy ? 'Working…' : 'Generate one'} variant="secondary" size="sm" isDisabled={busy} onClick={handleGenerateIdea} />
              </VStack>
            </VStack>
          )}
          {photo && (
            <img src={photo.dataUrl} alt={photo.name} className="dp-intake-preview" draggable="false" />
          )}
        </Card>

        {photo && (
          <VStack gap={2}>
            <HStack justify="between" align="center">
              <HStack gap={2} align="center">
                <button className={'dp-size-chip' + (activeTab === 'priority' ? ' active' : '')} onClick={() => setActiveTab('priority')}>Priority</button>
                <button className={'dp-size-chip' + (activeTab === 'parts' ? ' active' : '')} onClick={() => setActiveTab('parts')}>Parts</button>
                <InfoBubble tooltip="Priority splits the central subject (Focus) from supporting description (Details). Parts groups words by part of speech (Noun/Verb/Adjective) instead. Same words either way — deselect one anywhere and it drops out of Description everywhere." />
              </HStack>
              <HStack gap={2} align="center">
                {VARIATION_LABELS.map((label, i) => (
                  <button
                    key={label}
                    className={'dp-size-chip' + (i === variationIndex ? ' active' : '')}
                    disabled={switching}
                    onClick={() => handleVariationChange(i)}
                  >
                    {label}
                  </button>
                ))}
                <label className="dp-raw-toggle">
                  <input type="checkbox" checked={rawMode} onChange={(e) => setRawMode(e.target.checked)} />
                  <Text type="supporting" color="secondary">Raw</Text>
                </label>
                <IconButton
                  label="Re-analyze photo"
                  icon={<RefreshCw size={13} />}
                  variant="ghost"
                  size="sm"
                  tooltip="Re-analyze photo (regenerates all options + tags)"
                  isDisabled={analyzing}
                  onClick={handleRefreshAnalysis}
                />
              </HStack>
            </HStack>

            {/* min-height keeps this from collapsing to nothing while
                switching (real live-caught jank — content below would
                slide up then snap back down once tags land). */}
            <div style={{ minHeight: 96 }}>
              {switching && (
                <HStack gap={2} align="center">
                  <div className="dp-spinner" />
                  <Text type="supporting" color="secondary">Updating…</Text>
                </HStack>
              )}

              {!switching && wordTags && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tabColumns.length}, 1fr)`, gap: 16 }}>
                  {tabColumns.map((col) => (
                    <VStack key={col.key} gap={1.5}>
                      <Text type="supporting" color="secondary">{col.label}</Text>
                      <HStack gap={1.5} className="dp-preset-row">
                        {wordTags.map((t, i) => (t[activeTab === 'parts' ? 'pos' : 'priority'] === col.key ? (
                          <button
                            key={i}
                            className={'dp-preset-chip' + (selectedWordIndices.has(i) ? ' active' : '')}
                            onClick={() => toggleWord(i)}
                          >
                            {t.text}
                          </button>
                        ) : null))}
                      </HStack>
                    </VStack>
                  ))}
                </div>
              )}
            </div>

            {currentOptions && (
              <VStack gap={2}>
                <HStack gap={1} align="center">
                  <Text type="label">{VARIATION_LABELS[variationIndex]} options</Text>
                  <InfoBubble tooltip="3 distinct directions — pick one to tag into words above." />
                </HStack>
                <VStack gap={1.5}>
                  {currentOptions.map((opt, i) => (
                    <button
                      key={i}
                      className={'dp-option-card' + (i === currentSelected ? ' active' : '')}
                      disabled={switching}
                      onClick={() => handleOptionSelect(mode, i)}
                    >
                      {opt}
                    </button>
                  ))}
                </VStack>
              </VStack>
            )}

            {rawMode && (
              <textarea
                className="dp-prompt-textarea"
                rows={3}
                placeholder={analyzing ? 'Analyzing your photo…' : 'Describe what you want to generate'}
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
              />
            )}
            {analyzing && <Text type="supporting" color="secondary">Analyzing your photo…</Text>}
          </VStack>
        )}
      </VStack>

      <VStack gap={4} className="dp-intake-panel">
        {FX_PANEL_ENABLED && (
          <Card padding={4}>
            <VStack gap={3}>
              <Heading level={4}>Fx</Heading>
              <Switch
                label="180 Deg"
                description="Locks every source to 2 images and generates a front and back view instead of the usual variations."
                value={fx180}
                onChange={setFx180}
              />
            </VStack>
          </Card>
        )}
        <GenerateVariations project={project} saveData={saveData} />
        <GenerationHistory project={project} />
      </VStack>
    </div>
  )
}
