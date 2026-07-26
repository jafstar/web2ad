'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import SiteHeader from '../../../components/SiteHeader'
import ShotReview from '../../../components/adbuilder/ShotReview'

function FinishInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const stashId = searchParams.get('stash')
  const existingRunId = searchParams.get('run')
  const [runId, setRunId] = useState(null)
  const [schema, setSchema] = useState(null)
  const [stashData, setStashData] = useState(null)
  const [error, setError] = useState(null)
  const [phase, setPhase] = useState('loading') // loading -> confirm -> generating -> ready

  // Two ways to land here: a fresh free-preview handoff (?stash=..., needs
  // an explicit click before the real multi-minute generation starts - see
  // startGenerate below) or reopening an ad already recorded to this
  // account from /adbuilder/projects (?run=..., just a read, no long task
  // involved, so no confirmation needed).
  useEffect(() => {
    if (!stashId && !existingRunId) { setError('Missing your ad data — start over from the beginning.'); return }
    let cancelled = false
    ;(async () => {
      try {
        if (existingRunId) {
          const runRes = await fetch(`/api/adbuilder/run/${existingRunId}`)
          const runData = await runRes.json()
          if (!runRes.ok) throw new Error(runData.error || 'Could not load that ad')
          if (cancelled) return
          setRunId(existingRunId)
          setSchema(runData.schema)
          setPhase('ready')
          return
        }

        const stashRes = await fetch(`/api/adbuilder/stash?id=${encodeURIComponent(stashId)}`)
        const data = await stashRes.json()
        if (!stashRes.ok) throw new Error(data.error || 'Could not find your saved ad data')
        if (cancelled) return
        setStashData(data)
        setPhase('confirm')

        // Fire-and-forget: record the account-linked placeholder now, not
        // just once generation finishes, so abandoning this screen (back
        // button, closed tab) still leaves a real "continue this" entry
        // under My Ads instead of vanishing with no trace.
        fetch('/api/adbuilder/pending', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stashId, businessName: data.brief?.businessName, whatTheyDo: data.brief?.whatTheyDo }),
        }).catch(() => {})
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    })()
    return () => { cancelled = true }
  }, [stashId, existingRunId])

  async function startGenerate() {
    setPhase('generating'); setError(null)
    try {
      const runRes = await fetch('/api/adbuilder/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: stashData.brief, script: stashData.script, stashId }),
      })
      const runData = await runRes.json()
      if (!runRes.ok) throw new Error(runData.error || 'Could not generate your ad')
      setRunId(runData.runId)
      setSchema(runData.schema)
      setPhase('ready')
      // Swap the URL from ?stash= to ?run= now that a real run exists, so
      // refreshing this page reloads it instead of regenerating from
      // scratch (the stash path is only ever meant to fire once).
      router.replace(`/adbuilder/finish?run=${runData.runId}`)
    } catch (err) {
      setError(err.message)
      setPhase('confirm')
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
            {stashData.previewImage && (
              <img
                src={stashData.previewImage} alt="Your free preview"
                style={{ width: '100%', borderRadius: 10, marginBottom: 20, display: 'block' }}
              />
            )}
            <h2 style={{ fontSize: 24, marginBottom: 10 }}>Ready to generate {stashData.brief?.businessName}'s full ad?</h2>
            <p style={{ color: 'var(--mist)', fontSize: 14, marginBottom: 24 }}>This is the real multi-shot version with motion — takes a few minutes once it starts.</p>
            <button onClick={startGenerate} className="btn-gradient" style={{ width: '100%', height: 48 }}>Continue</button>
          </div>
        )}
        {phase === 'generating' && (
          <div style={{ textAlign: 'center', maxWidth: 480, margin: '80px auto' }}>
            <div className="dp-spinner" style={{ width: 32, height: 32, margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: 22, marginBottom: 8 }}>Generating your full ad…</h2>
            <p style={{ color: 'var(--mist)', fontSize: 14 }}>This takes a few minutes — real shots, real motion, not a template.</p>
          </div>
        )}
        {!error && phase === 'ready' && runId && schema && (
          <ShotReview runId={runId} initialSchema={schema} />
        )}
      </div>
    </div>
  )
}

export default function FinishPage() {
  return (
    <Suspense fallback={null}>
      <FinishInner />
    </Suspense>
  )
}
