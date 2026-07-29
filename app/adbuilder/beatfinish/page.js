'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import SiteHeader from '../../../components/SiteHeader'

// v2's "finish" page. Restructured live 2026-07-29 to fix a real
// production timeout: generating every beat inside one giant request
// (the old single-call /api/adbuilder/beatrun) could exceed Vercel's
// function duration ceiling once tonight's writing-quality improvements
// made ads longer/richer - and simply raising maxDuration past 300s
// failed to deploy outright (no Fluid Compute config for this project).
// Now: start (claims the stash) -> beat xN (staggered, one request per
// scene, each independently short) -> combine (fast, compositing only).
// No single request ever has to span the whole generation, regardless of
// ad length - same principle v1's per-shot ShotReview polling already
// uses, just without needing a background-job schema for it.
const STAGGER_MS = 4000

function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function BeatFinishInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const stashId = searchParams.get('stash')
  const existingRunId = searchParams.get('run')
  const [stashData, setStashData] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [phase, setPhase] = useState('loading') // loading -> confirm -> generating -> ready
  const [forking, setForking] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  // Once /start succeeds, the stash is consumed either way - these hold
  // what's needed to retry just the failed scenes without going back to
  // a (by then dead) confirm screen.
  const [genRunId, setGenRunId] = useState(null)
  const [genBrief, setGenBrief] = useState(null)
  const [genAtmosphere, setGenAtmosphere] = useState(null)
  const [genBeats, setGenBeats] = useState(null)

  // Two ways to land here: a fresh free-preview handoff (?stash=..., needs
  // an explicit click before the real generation starts) or reopening a
  // v2 ad already recorded to this account from /adbuilder/projects
  // (?run=..., just a read - reuses the already-RLS-scoped /projects list
  // rather than adding a new lookup route, since v2 rows are only ever
  // inserted once the video already exists, so there's nothing to poll).
  useEffect(() => {
    let cancelled = false
    if (existingRunId) {
      ;(async () => {
        try {
          const res = await fetch('/api/adbuilder/projects')
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Could not load your ads')
          const proj = data.projects?.find((p) => p.data?.v2 && p.data?.runId === existingRunId)
          if (!proj) throw new Error('Could not find that ad')
          if (cancelled) return
          setResult({ url: proj.data.videoUrl, durationSeconds: proj.data.durationSeconds, beatCount: proj.data.beatCount, runId: existingRunId })
          setPhase('ready')
        } catch (err) {
          if (!cancelled) setError(err.message)
        }
      })()
      return () => { cancelled = true }
    }

    if (!stashId) { setError('Missing your ad data — start over from the beginning.'); return }
    ;(async () => {
      try {
        const res = await fetch(`/api/adbuilder/stash?id=${encodeURIComponent(stashId)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Could not find your saved ad data')
        if (cancelled) return
        setStashData(data)
        setPhase('confirm')
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    })()
    return () => { cancelled = true }
  }, [stashId, existingRunId])

  useEffect(() => {
    if (phase !== 'generating') { setElapsed(0); return }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  async function generateOneBeat(runId, beat, brief, atmosphere) {
    const res = await fetch('/api/adbuilder/beatrun/beat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, beat, brief, atmosphere, referenceImageDataUrl: brief.referenceImageDataUrl || null }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Could not generate scene ${beat.id}`)
    return data
  }

  // Generates whichever of `beats` don't already have a renderUrl,
  // staggered the same way the old server-side loop was (Hailuo's real
  // RPM limit), updating genBeats live as each one lands so the UI shows
  // real per-scene progress instead of a blind spinner. Returns the full,
  // now-complete beats array. Rejects if ANY beat fails - callers decide
  // what to do (the other in-flight beats keep running and still update
  // genBeats even after the rejection, so a retry only needs whatever's
  // still actually missing).
  async function generateBeatsWithProgress(runId, beats, brief, atmosphere) {
    const finalBeats = [...beats]
    await Promise.all(beats.map(async (beat, i) => {
      if (beat.renderUrl) return
      if (i > 0) await new Promise((r) => setTimeout(r, i * STAGGER_MS))
      const data = await generateOneBeat(runId, beat, brief, atmosphere)
      const updated = { ...beat, keyframeUrl: data.keyframeUrl, renderUrl: data.renderUrl }
      finalBeats[i] = updated
      setGenBeats((prev) => prev.map((b) => (b.id === beat.id ? updated : b)))
    }))
    return finalBeats
  }

  async function finishGeneration(runId, brief, beats, atmosphere) {
    const res = await fetch('/api/adbuilder/beatrun/combine', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, brief, beats, atmosphere }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Could not finish your ad')
    setResult(data)
    setPhase('ready')
    // Real bug this fixes, live-caught: this page used to stay on
    // ?stash= for its whole lifetime, so bouncing back through /login
    // (which auto-redirects straight through when already signed in)
    // landed right back on a confirm screen still pointing at a
    // technically-consumed stash - swapping the URL to ?run= here means
    // a return trip reopens the finished ad read-only (see the
    // existingRunId branch above) instead of re-offering "Generate My
    // Ad". The server-side claim in beatrun/start/route.js is the real
    // backstop; this just keeps the URL honest for the common case.
    router.replace(`/adbuilder/beatfinish?run=${data.runId}`)
  }

  async function startGenerate() {
    setPhase('generating'); setError(null)
    let runId, brief, beats, atmosphere
    try {
      const startRes = await fetch('/api/adbuilder/beatrun/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stashId }),
      })
      const startData = await startRes.json()
      if (!startRes.ok) throw new Error(startData.error || 'Could not start generation')
      ;({ runId, brief, beats, atmosphere } = startData)
      beats = beats.map((b) => ({ ...b, keyframeUrl: null, renderUrl: null }))
      setGenRunId(runId); setGenBrief(brief); setGenAtmosphere(atmosphere); setGenBeats(beats)
    } catch (err) {
      // Failed before a runId ever existed - the stash is either
      // genuinely gone or never existed. Nothing to retry from here.
      setError(err.message)
      setPhase('confirm')
      return
    }

    try {
      const finishedBeats = await generateBeatsWithProgress(runId, beats, brief, atmosphere)
      await finishGeneration(runId, brief, finishedBeats, atmosphere)
    } catch (err) {
      // A real runId + beats already exist by now (the stash is consumed
      // either way) - stay on 'generating' with a retry option, never
      // back to 'confirm' (which would point at a dead stash).
      setError(err.message)
    }
  }

  async function retryGeneration() {
    if (!genRunId || !genBeats) return
    setPhase('generating'); setError(null)
    try {
      const finishedBeats = await generateBeatsWithProgress(genRunId, genBeats, genBrief, genAtmosphere)
      await finishGeneration(genRunId, genBrief, finishedBeats, genAtmosphere)
    } catch (err) {
      setError(err.message)
    }
  }

  async function forkToEdit() {
    setForking(true); setError(null)
    try {
      const res = await fetch('/api/adbuilder/beatedit/fork', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: result.runId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not fork this ad')
      window.location.href = `/adbuilder/beatedit?run=${data.runId}`
    } catch (err) {
      setError(err.message)
      setForking(false)
    }
  }

  const readyCount = genBeats?.filter((b) => b.renderUrl).length ?? 0

  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <div style={{ padding: '56px 32px 100px' }}>
        {error && (
          <div className="card" style={{ maxWidth: 500, margin: '0 auto 20px', padding: 24, borderColor: 'var(--danger)', textAlign: 'center' }}>
            <span style={{ color: 'var(--danger)' }}>{error}</span>
          </div>
        )}
        {!error && phase === 'loading' && (
          <div style={{ textAlign: 'center', maxWidth: 480, margin: '80px auto' }}>
            <div className="dp-spinner" style={{ width: 32, height: 32, margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: 22, marginBottom: 8 }}>Getting your ad ready…</h2>
          </div>
        )}
        {phase === 'confirm' && stashData && (
          <div className="card" style={{ maxWidth: 480, margin: '80px auto', padding: 32, textAlign: 'center' }}>
            {stashData.script?.sceneImageUrl && (
              <img src={stashData.script.sceneImageUrl} alt="Scene 1" style={{ width: '100%', borderRadius: 10, marginBottom: 20, display: 'block' }} />
            )}
            <h2 style={{ fontSize: 24, marginBottom: 10 }}>Ready to generate {stashData.brief?.businessName}'s full ad?</h2>
            <p style={{ color: 'var(--mist)', fontSize: 14, marginBottom: 24 }}>
              {stashData.script?.beats?.length || 0} scenes, real motion and narration throughout — takes a few minutes once it starts.
            </p>
            <button onClick={startGenerate} className="btn-gradient" style={{ width: '100%', height: 48 }}>Generate My Ad</button>
          </div>
        )}
        {phase === 'generating' && (
          <div style={{ textAlign: 'center', maxWidth: 480, margin: '80px auto' }}>
            <div className="dp-spinner" style={{ width: 32, height: 32, margin: '0 auto 18px' }} />
            <h2 style={{ fontSize: 22, marginBottom: 8 }}>Generating your full ad…</h2>
            <p style={{ color: 'var(--mist)', fontSize: 14, marginBottom: 14 }}>
              {genBeats ? `${readyCount} of ${genBeats.length} scenes ready…` : 'Starting…'}
            </p>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--mist)', letterSpacing: '0.04em', marginBottom: error && genRunId ? 18 : 0 }}>
              {formatElapsed(elapsed)} elapsed
            </div>
            {error && genRunId && (
              <button onClick={retryGeneration} className="btn-gradient" style={{ padding: '10px 24px' }}>Retry Remaining Scenes</button>
            )}
          </div>
        )}
        {!error && phase === 'ready' && result && (
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <video
              src={result.url} controls autoPlay muted loop playsInline
              style={{ width: '100%', borderRadius: 10, marginBottom: 20, display: 'block', background: '#000' }}
            />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a
                href={result.url} download="ad.mp4"
                className="btn-gradient" style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, textDecoration: 'none' }}
              >
                Download Your Ad
              </a>
              <button onClick={forkToEdit} disabled={forking} className="btn-ghost" style={{ flex: 1, minWidth: 200, height: 48, opacity: forking ? 0.6 : 1 }}>
                {forking ? 'Forking…' : 'Fork to Edit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BeatFinishPage() {
  return (
    <Suspense fallback={null}>
      <BeatFinishInner />
    </Suspense>
  )
}
