'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import SiteHeader from '../../../components/SiteHeader'

// v2's "finish" page - mirrors v1's finish/page.js confirm/generating/
// ready flow, but simpler: no ShotReview/per-shot editing, generation
// runs as one long request (/api/adbuilder/beatrun, real signup gate)
// and the result renders straight to a video + download button.
function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function generatingStageLabel(seconds, beatCount) {
  if (seconds < 10) return 'Synthesizing narration…'
  const sceneStageEnd = 15 + beatCount * 25
  if (seconds < sceneStageEnd) return `Generating your ${beatCount || ''} scenes — image and motion for each, one at a time. This is the slow part.`
  return 'Should be close now — trimming, mixing, and compositing the final video…'
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
  const [autoCountdown, setAutoCountdown] = useState(null) // null = no timer running; number = seconds left
  const [elapsed, setElapsed] = useState(0)

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
        // Real friction this removes: clicking "Generate Full Ad &
        // Download" on step 2 IS the real confirmation - a second manual
        // click here, after whatever login/signup detour, was pure
        // redundant friction. Auto-fires after a short countdown instead.
        //
        // Real bug this guards against, live-caught: this used to be a
        // separate effect keyed on `phase`, which meant ANY transition
        // back to 'confirm' restarted the countdown - including the
        // catch block in startGenerate() below, which sets phase back to
        // 'confirm' after a FAILURE. A persistent failure (e.g. an
        // exhausted API credit balance) turned that into a silent
        // infinite retry loop: fail -> confirm -> 10s countdown -> retry
        // -> fail -> confirm -> 10s countdown -> retry..., burning a
        // fresh real generation attempt every cycle for as long as the
        // tab stayed open. Starting the countdown only here, inline with
        // the ONE real fresh-stash-load path, means a failed generation
        // always requires an explicit manual click to retry.
        setAutoCountdown(10)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    })()
    return () => { cancelled = true }
  }, [stashId, existingRunId])

  useEffect(() => {
    if (autoCountdown === null) return
    if (autoCountdown <= 0) {
      setAutoCountdown(null)
      startGenerate()
      return
    }
    const t = setTimeout(() => setAutoCountdown((s) => s - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCountdown])

  // This is one long synchronous request (beatrun/route.js) with no
  // real-time progress signal from the server - rather than a static
  // spinner that looks frozen for minutes, ticks a real elapsed-time
  // counter (proves it's alive) alongside honest, roughly-staged status
  // text based on the pipeline's own known order (narration first, then
  // the slow per-scene generation, then compositing) - not a fake percent
  // bar, since there's nothing real to back a precise number.
  useEffect(() => {
    if (phase !== 'generating') { setElapsed(0); return }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  async function startGenerate() {
    setPhase('generating'); setError(null)
    try {
      const { brief, script } = stashData
      const res = await fetch('/api/adbuilder/beatrun', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, beats: script.beats, atmosphere: script.atmosphere, stashId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not generate your ad')
      setResult(data)
      setPhase('ready')
      // Real bug this fixes, live-caught: this page used to stay on
      // ?stash= for its whole lifetime, so bouncing back through /login
      // (which auto-redirects straight through when already signed in)
      // landed right back on a confirm screen still pointing at a
      // technically-consumed stash - swapping the URL to ?run= here means
      // a return trip reopens the finished ad read-only (see the
      // existingRunId branch above) instead of re-offering "Generate My
      // Ad". The server-side claim in beatrun/route.js is the real
      // backstop; this just keeps the URL honest for the common case.
      router.replace(`/adbuilder/beatfinish?run=${data.runId}`)
    } catch (err) {
      setError(err.message)
      setPhase('confirm')
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
            {autoCountdown !== null ? (
              <>
                <p style={{ color: 'var(--mist)', fontSize: 13, marginBottom: 12 }}>Starting in {autoCountdown}s…</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setAutoCountdown(null)} className="btn-ghost" style={{ flex: 1, height: 48 }}>Wait, cancel</button>
                  <button onClick={startGenerate} className="btn-gradient" style={{ flex: 1, height: 48 }}>Generate Now</button>
                </div>
              </>
            ) : (
              <button onClick={startGenerate} className="btn-gradient" style={{ width: '100%', height: 48 }}>Generate My Ad</button>
            )}
          </div>
        )}
        {phase === 'generating' && (
          <div style={{ textAlign: 'center', maxWidth: 480, margin: '80px auto' }}>
            <div className="dp-spinner" style={{ width: 32, height: 32, margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: 22, marginBottom: 8 }}>Generating your full ad…</h2>
            <p style={{ color: 'var(--mist)', fontSize: 14, marginBottom: 14 }}>
              {generatingStageLabel(elapsed, stashData?.script?.beats?.length || 0)}
            </p>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--mist)', letterSpacing: '0.04em' }}>
              {formatElapsed(elapsed)} elapsed
            </div>
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
