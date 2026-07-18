'use client'

import React from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { HStack } from '@astryxdesign/core/HStack'
import { Card } from '@astryxdesign/core/Card'
import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Settings2, Square, RectangleVertical, RectangleHorizontal } from 'lucide-react'
import { useBflKey, useRecraftKey, useGeminiKey, useImageGeneration, SIZE_PRESETS } from '../../lib/useImageGeneration'
import { strengthForIndex, fluxModeForIndex, VARIATION_DEFAULT_INDEX } from '../../lib/variationModes'
import { useCreditsCheck } from '../../lib/useCredits'
import { sectionAtom, fx180Atom } from '../../lib/atoms'
import PoweredByBadge from '../PoweredByBadge'
import InfoBubble from '../InfoBubble'

const SIZE_ICONS = { square: Square, portrait: RectangleVertical, landscape: RectangleHorizontal }

// Ported from designpipe-app/renderer/components/photos/GenerateVariations.jsx
// — same mood/orchestrator-pattern presets. The one real addition: a
// credits:check gate on the generate button (see lib/useCredits.js),
// wired via the same shared channel DesignPipe stubs as always-unlimited.
const MOOD_PRESETS = [
  { key: 'cinematic', label: 'Moody Cinematic', prompt: 'cinematic lighting, dramatic shadows, shot on 35mm film, shallow depth of field, moody atmosphere' },
  { key: 'airy', label: 'Bright & Airy', prompt: 'bright natural light, soft airy tones, clean minimal composition, high-key lighting' },
  { key: 'golden', label: 'Golden Hour', prompt: 'warm golden hour lighting, long soft shadows, gentle sun flare, cinematic warmth' },
  { key: 'studio', label: 'Studio Product', prompt: 'clean studio lighting, seamless background, sharp focus, commercial product photography' },
  { key: 'vintage', label: 'Vintage Film', prompt: 'vintage film grain, faded colors, nostalgic tone, shot on expired film stock' },
  { key: 'editorial', label: 'High Contrast Editorial', prompt: 'high contrast, bold shadows, editorial photography style, dramatic directional lighting' },
]

function LabelWithInfo({ children, tooltip }) {
  return (
    <HStack gap={1} align="center">
      <Text type="label">{children}</Text>
      <InfoBubble tooltip={tooltip} />
    </HStack>
  )
}

function Stepper({ provider, value, onChange, max = 6, locked, lockedTooltip, disabled, extra }) {
  const setSection = useSetAtom(sectionAtom)
  return (
    <HStack justify="between" align="center" className={locked ? 'dp-stepper-locked' : undefined}>
      <HStack gap={1} align="center">
        <PoweredByBadge provider={provider} plain />
        {locked && <InfoBubble tooltip={lockedTooltip} onClick={() => setSection('settings')} />}
        {extra}
      </HStack>
      <HStack gap={4} align="center">
        <button className="dp-step-btn" disabled={locked || disabled} onClick={() => onChange(Math.max(0, value - 1))}>−</button>
        <Text type="body">{locked ? 0 : value}</Text>
        <button className="dp-step-btn" disabled={locked || disabled} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </HStack>
    </HStack>
  )
}

export default function GenerateVariations({ project, saveData }) {
  const bfl = useBflKey()
  const recraft = useRecraftKey()
  const gemini = useGeminiKey()
  const { generate, busy, generationProjectId } = useImageGeneration()
  const setSection = useSetAtom(sectionAtom)
  const busyHere = busy && generationProjectId === project?.id
  const anotherProjectBusy = busy && !busyHere

  const [fx180] = useAtom(fx180Atom)
  const [sizeKey, setSizeKey] = React.useState('landscape')
  const [fluxCount, setFluxCount] = React.useState(1)
  const [recraftCount, setRecraftCount] = React.useState(1)
  const [geminiCount, setGeminiCount] = React.useState(1)

  // Fx panel's "180 Deg" mode: every source locks to exactly 2 (front +
  // back) the moment it's turned on. Steppers stay disabled at 2 for as
  // long as it's on; turning it off just unlocks them again.
  React.useEffect(() => {
    if (fx180) { setFluxCount(2); setRecraftCount(2); setGeminiCount(2) }
  }, [fx180])
  const [manualStrength, setManualStrength] = React.useState(null)
  const [style, setStyle] = React.useState('realistic_image')
  const [showRecraftSettings, setShowRecraftSettings] = React.useState(false)
  const [moodKey, setMoodKey] = React.useState(null)

  const photo = project?.data?.photo ?? null
  // Real source of truth for the prompt text lives in IntakeSection now
  // (project.data.description, seeded from the photo analysis directly
  // into that one persisted field) — this component just reads it.
  const description = project?.data?.description ?? ''
  // Same for variationIndex (the 5-position Exact…Category slider, also
  // in IntakeSection) — sets Recraft's strength default and which of
  // Flux's reference-conditioned prompt wrappers applies.
  const variationIndex = project?.data?.variationIndex ?? VARIATION_DEFAULT_INDEX
  // Derived directly (not synced via effect) so switching the slider
  // takes effect on the very next render — an effect-based sync here
  // raced a fast slider-drag-then-generate click against a stale
  // `strength` value, a real live-caught bug. The Advanced Recraft
  // "Strength" slider still fine-tunes it within a session
  // (manualStrength); it resets back to the slider's default the moment
  // variationIndex itself changes.
  const strength = manualStrength ?? strengthForIndex(variationIndex)
  React.useEffect(() => { setManualStrength(null) }, [variationIndex])

  const recraftLocked = recraft.loaded && !recraft.key
  const effectiveRecraftCount = recraftLocked ? 0 : recraftCount

  const vectorModeActive = style === 'vector_illustration' && effectiveRecraftCount > 0

  const fluxLocked = (bfl.loaded && !bfl.key) || vectorModeActive
  const geminiLocked = (gemini.loaded && !gemini.key) || vectorModeActive
  const fluxLockedTooltip = vectorModeActive
    ? 'Vector mode only supports Recraft — switch Style back to Photo to use Flux.'
    : 'Add a Black Forest Labs key in Settings to use this source.'
  const geminiLockedTooltip = vectorModeActive
    ? 'Vector mode only supports Recraft — switch Style back to Photo to use Gemini.'
    : 'Add a Gemini key in Settings to use this source.'

  const effectiveFluxCount = fluxLocked ? 0 : fluxCount
  const effectiveGeminiCount = geminiLocked ? 0 : geminiCount
  const totalCount = effectiveFluxCount + effectiveRecraftCount + effectiveGeminiCount

  const credits = useCreditsCheck(totalCount)
  const outOfCredits = !credits.unlimited && !credits.ok

  const finalPrompt = React.useMemo(() => {
    const typed = description.trim()
    const mood = MOOD_PRESETS.find((m) => m.key === moodKey)
    if (typed && mood) return `${typed} — ${mood.prompt}`
    return typed || mood?.prompt || ''
  }, [description, moodKey])

  const handleGenerate = () => {
    if (!finalPrompt.trim() || totalCount === 0 || outOfCredits) return
    generate({
      prompt: finalPrompt,
      referenceImageDataUrl: photo?.dataUrl,
      fluxCount: effectiveFluxCount,
      recraftCount: effectiveRecraftCount,
      recraftStrength: strength,
      recraftStyle: style,
      geminiCount: effectiveGeminiCount,
      sizeKey,
      variationMode: fluxModeForIndex(variationIndex),
      projectId: project.id,
      frontBack: fx180,
    })
    setSection('critique')
  }

  if (!photo) return null

  if (!bfl.loaded || !recraft.loaded || !gemini.loaded) return null

  return (
    <VStack gap={4}>
      <Card padding={4}>
        <VStack gap={3}>
          <Heading level={4}>Settings</Heading>

          <Button
            label={
              busyHere ? 'Generating… (see Critique)'
                : anotherProjectBusy ? 'Another project is generating…'
                : outOfCredits ? 'Out of credits'
                : `Create ${totalCount} Image${totalCount === 1 ? '' : 's'}`
            }
            variant="primary"
            className="dp-btn-blue"
            isDisabled={busy || !finalPrompt.trim() || totalCount === 0 || outOfCredits}
            onClick={handleGenerate}
          />

          <LabelWithInfo tooltip="Recraft and Gemini don't take an explicit size — this only changes Flux's output.">
            Size
          </LabelWithInfo>
          <HStack gap={2}>
            {SIZE_PRESETS.map((s) => {
              const SizeIcon = SIZE_ICONS[s.key]
              return (
                <button
                  key={s.key}
                  className={'dp-size-chip' + (sizeKey === s.key ? ' active' : '')}
                  onClick={() => setSizeKey(s.key)}
                >
                  <HStack gap={1.5} align="center">
                    <SizeIcon size={14} />
                    <span>{s.label}</span>
                  </HStack>
                </button>
              )
            })}
          </HStack>

          <LabelWithInfo tooltip="Flux and Gemini both explore from your prompt alone — no reference image, so they stay genuinely varied. Recraft actually matches your photo, with an adjustable strength dial.">
            Source
          </LabelWithInfo>
          <VStack gap={2}>
            <Stepper provider="gemini" value={geminiCount} onChange={setGeminiCount} locked={geminiLocked} lockedTooltip={geminiLockedTooltip} disabled={fx180} />
            <Stepper provider="bfl" value={fluxCount} onChange={setFluxCount} locked={fluxLocked} lockedTooltip={fluxLockedTooltip} disabled={fx180} />
            <Stepper
              provider="recraft"
              value={recraftCount}
              onChange={setRecraftCount}
              locked={recraftLocked}
              lockedTooltip="Add a Recraft key in Settings to use this source."
              disabled={fx180}
              extra={effectiveRecraftCount > 0 && (
                <IconButton
                  label="Recraft settings"
                  icon={<Settings2 size={12} />}
                  variant={showRecraftSettings ? 'secondary' : 'ghost'}
                  size="sm"
                  tooltip="Recraft strength"
                  onClick={() => setShowRecraftSettings((v) => !v)}
                />
              )}
            />
          </VStack>

          {effectiveRecraftCount > 0 && showRecraftSettings && (
            <VStack gap={3}>
              <VStack gap={1}>
                <HStack gap={1} align="center">
                  <Text type="label">Format</Text>
                  <InfoBubble tooltip="Vector returns a real SVG (Recraft's own vector model), not just a vector-looking raster. Photo is the usual raster output." />
                </HStack>
                <HStack gap={2}>
                  <button className={'dp-size-chip' + (style === 'realistic_image' ? ' active' : '')} onClick={() => setStyle('realistic_image')}>Photo</button>
                  <button className={'dp-size-chip' + (style === 'vector_illustration' ? ' active' : '')} onClick={() => setStyle('vector_illustration')}>Vector</button>
                </HStack>
              </VStack>

              <VStack gap={1}>
                <HStack justify="between" align="center">
                  <HStack gap={1} align="center">
                    <Text type="label">Strength</Text>
                    <InfoBubble tooltip="0 stays close to your photo, 1 leans mostly on the prompt instead." />
                  </HStack>
                  <Text type="label">{Math.round(strength * 100)}%</Text>
                </HStack>
                <input type="range" className="dp-range" min="0" max="1" step="0.05" value={strength} onChange={(e) => setManualStrength(parseFloat(e.target.value))} />
              </VStack>
            </VStack>
          )}

          <VStack gap={1}>
            <LabelWithInfo tooltip="A whole block of real photography/lighting language gets appended for you — pick one, or None to skip. These are aesthetic directions, not photo facts, so only one applies at a time.">
              Mood
            </LabelWithInfo>
            <HStack gap={2} className="dp-preset-row">
              <button className={'dp-preset-chip' + (moodKey === null ? ' active' : '')} onClick={() => setMoodKey(null)}>None</button>
              {MOOD_PRESETS.map((m) => (
                <button
                  key={m.key}
                  className={'dp-preset-chip' + (moodKey === m.key ? ' active' : '')}
                  onClick={() => setMoodKey(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </HStack>
          </VStack>
        </VStack>
      </Card>
    </VStack>
  )
}
