'use client'

import React from 'react'
import { useAtom } from 'jotai'
import { generationResultsAtom, generationProgressAtom, generationBusyAtom, generationErrorAtom, generationProjectIdAtom } from './atoms'

export const SIZE_PRESETS = [
  { key: 'landscape', label: 'Landscape', width: 480, height: 320 },
  { key: 'portrait', label: 'Portrait', width: 320, height: 480 },
  { key: 'square', label: 'Square', width: 384, height: 384 },
]

function useStoredKey(getChannel, setChannel) {
  const [key, setKeyState] = React.useState('')
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    window.ipc.invoke(getChannel).then((k) => { setKeyState(k); setLoaded(true) })
  }, [getChannel])

  const setKey = async (k) => {
    await window.ipc.invoke(setChannel, k)
    setKeyState(k)
  }

  return { key, loaded, setKey }
}

// Always resolves truthy via the ipc shim (settings:getXKey → "operator-
// managed") — no BYOK UI in genstock, nothing ever locks.
export function useBflKey() { return useStoredKey('settings:getBflKey', 'settings:setBflKey') }
export function useRecraftKey() { return useStoredKey('settings:getRecraftKey', 'settings:setRecraftKey') }
export function useAnthropicKey() { return useStoredKey('settings:getAnthropicKey', 'settings:setAnthropicKey') }
export function useGeminiKey() { return useStoredKey('settings:getGeminiKey', 'settings:setGeminiKey') }

export function useImageGeneration() {
  const [progress, setProgress] = useAtom(generationProgressAtom)
  const [results, setResults] = useAtom(generationResultsAtom)
  const [busy, setBusy] = useAtom(generationBusyAtom)
  const [error, setError] = useAtom(generationErrorAtom)
  const [generationProjectId, setGenerationProjectId] = useAtom(generationProjectIdAtom)

  React.useEffect(() => {
    // Real, not-yet-closed gap (see lib/ipcShim.js): DesignPipe streams
    // per-image progress through this event; genstock-web's generate API
    // resolves once with everything at the end instead. Kept wired for
    // when real SSE-based streaming replaces the no-op shim handler —
    // until then, `generate()` below populates results from the
    // resolved invoke() value directly.
    const off = window.ipc.on('images:progress', (p) => {
      setProgress({ done: p.done, total: p.total })
      if (p.result) setResults((prev) => [...prev, p.result])
      if (p.error) setError(p.error)
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const generate = async ({ prompt, referenceImageDataUrl, fluxCount, recraftCount, recraftStrength, recraftStyle, geminiCount, sizeKey, variationMode, projectId, frontBack }) => {
    setBusy(true)
    setError(null)
    setResults([])
    setGenerationProjectId(projectId)
    const total = fluxCount + recraftCount + geminiCount
    setProgress({ done: 0, total })
    try {
      const size = SIZE_PRESETS.find((s) => s.key === sizeKey) ?? SIZE_PRESETS[0]
      const batchResults = await window.ipc.invoke('images:generateBatch', {
        prompt,
        referenceImageDataUrl,
        size,
        fluxCount,
        recraftCount,
        recraftStrength,
        recraftStyle,
        geminiCount,
        variationMode,
        projectId,
        frontBack,
      })
      setResults(batchResults)
      setProgress({ done: batchResults.length, total })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // Story type's generation path - one reference-conditioned Flux call
  // per scene the user wrote, not N variations of one prompt. Shares the
  // exact same atoms as generate() above so CritiqueSection's existing
  // round-saving effect picks up the results transparently - Story
  // doesn't need its own Critique/Lightbox/Export, it reuses Photos' as-is.
  const generateStory = async ({ referenceImageDataUrl, scenes, projectId }) => {
    setBusy(true)
    setError(null)
    setResults([])
    setGenerationProjectId(projectId)
    setProgress({ done: 0, total: scenes.length })
    try {
      const batchResults = await window.ipc.invoke('images:generateStoryBatch', { referenceImageDataUrl, scenes, projectId })
      setResults(batchResults)
      setProgress({ done: batchResults.length, total: scenes.length })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return { generate, generateStory, progress, results, busy, error, setResults, generationProjectId }
}
