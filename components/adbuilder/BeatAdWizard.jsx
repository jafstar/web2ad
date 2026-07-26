'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

// Real 3-step v2 funnel, requested live 2026-07-26 to replace v1's 4-step
// free wizard + separate signup gate: url -> first-scene preview (audio +
// narrator + visual, powered by the beat pipeline's real per-phrase
// story) -> generate the full ad + download. No separate "review the
// brief" or "review the script text" steps - step 2 shows the real first
// scene directly instead of asking for a click through an intermediate
// summary screen. v1 (components/adbuilder/AdBuilderWizard.jsx) is
// untouched and still lives at /adbuilder/classic.
const STEPS = ['url', 'preview']

const INGEST_METHODS = [
  { key: 'url', label: 'Website URL', ready: true },
  { key: 'text', label: 'Describe It', ready: true },
  { key: 'photo', label: 'Upload Logo/Photo', ready: false },
  { key: 'social', label: 'Social Handle', ready: false },
]

export default function BeatAdWizard() {
  return (
    <Suspense fallback={null}>
      <BeatAdWizardInner />
    </Suspense>
  )
}

function BeatAdWizardInner() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState('url')
  const [ingestMethod, setIngestMethod] = useState('url')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [brief, setBrief] = useState(null)
  const [beats, setBeats] = useState(null)
  const [atmosphere, setAtmosphere] = useState(null)
  const [narratorAudioUrl, setNarratorAudioUrl] = useState(null)
  const [sceneImageUrl, setSceneImageUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')
  const [error, setError] = useState(null)

  function normalizeUrl(value) {
    const trimmed = value.trim()
    if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
  }

  // One continuous action from the visitor's side (submit a URL, land on
  // the real first scene) even though it's two real API calls under the
  // hood - moving to the 'preview' step immediately lets the loading
  // state render in that step's slot instead of sitting on step 1.
  async function ingestAndPreview(body) {
    setBusy(true); setError(null); setStep('preview')
    try {
      setBusyLabel(body.method === 'text' ? 'Reading your description…' : 'Reading your site…')
      const ingestRes = await fetch('/api/adbuilder/ingest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const ingestData = await ingestRes.json()
      if (!ingestRes.ok) throw new Error(ingestData.error || 'Could not analyze that')
      setBrief(ingestData.brief)

      setBusyLabel('Writing your story + rendering scene 1… (~30-45s)')
      const previewRes = await fetch('/api/adbuilder/beatpreview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: ingestData.brief }),
      })
      const previewData = await previewRes.json()
      if (!previewRes.ok) throw new Error(previewData.error || 'Could not build your preview')
      setBeats(previewData.beats)
      setAtmosphere(previewData.atmosphere)
      setNarratorAudioUrl(previewData.narratorAudioUrl)
      setSceneImageUrl(previewData.sceneImageUrl)
    } catch (err) {
      setError(err.message)
      setStep('url')
    } finally {
      setBusy(false)
    }
  }

  async function runIngest(e) {
    e.preventDefault()
    const normalizedUrl = normalizeUrl(url)
    const body = ingestMethod === 'text' ? { method: 'text', text: text.trim() } : { method: 'url', url: normalizedUrl }
    if (ingestMethod === 'text' ? !text.trim() : !normalizedUrl) return
    ingestAndPreview(body)
  }

  useEffect(() => {
    const urlParam = searchParams.get('url')
    if (!urlParam) return
    const normalized = normalizeUrl(urlParam)
    setUrl(normalized)
    ingestAndPreview({ method: 'url', url: normalized })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Same stash-then-redirect pattern as v1's goFinish: a magic-link email
  // very often opens in a different tab, so the brief+beats need to
  // survive server-side, keyed by a short id, rather than living in
  // sessionStorage. /api/adbuilder/stash is fully reused as-is - its
  // `script` column is a generic jsonb blob, so it holds v2's beat shape
  // here just as happily as v1's script shape.
  async function goGenerate() {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/adbuilder/stash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, script: { mode: 'beat', beats, atmosphere, sceneImageUrl }, previewImage: null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not continue to signup')
      const finishUrl = `/adbuilder/beatfinish?stash=${data.stashId}`

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        window.location.href = finishUrl
      } else {
        window.location.href = `/login?intent=signup&next=${encodeURIComponent(finishUrl)}`
      }
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const stepIndex = STEPS.indexOf(step)
  const firstBeat = beats?.[0]

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 36, justifyContent: 'center' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 44, height: 4, borderRadius: 2,
            background: i <= stepIndex ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.12)',
          }} />
        ))}
      </div>

      {error && (
        <div className="card" style={{ padding: 16, marginBottom: 20, borderColor: 'var(--danger)' }}>
          <span style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</span>
        </div>
      )}

      {step === 'url' && (
        <div className="card" style={{ padding: 32 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Step 1 of 3</div>
          <h2 style={{ fontSize: 26, marginBottom: 10 }}>Where should we start?</h2>
          <p style={{ color: 'var(--mist)', fontSize: 14.5, marginBottom: 22 }}>Pick how you want to feed us your business.</p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
            {INGEST_METHODS.map((m) => (
              <button
                key={m.key}
                type="button"
                disabled={!m.ready}
                onClick={() => setIngestMethod(m.key)}
                title={m.ready ? undefined : 'Coming soon'}
                style={{
                  padding: '9px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 500,
                  border: `1px solid ${ingestMethod === m.key ? 'var(--accent-solid)' : 'rgba(255,255,255,0.12)'}`,
                  background: ingestMethod === m.key ? 'rgba(124,58,237,0.14)' : 'transparent',
                  color: m.ready ? 'var(--fg)' : 'var(--mist)',
                  cursor: m.ready ? 'pointer' : 'not-allowed',
                  opacity: m.ready ? 1 : 0.5,
                }}
              >
                {m.label}{!m.ready && ' (soon)'}
              </button>
            ))}
          </div>

          <form onSubmit={runIngest}>
            {ingestMethod === 'text' ? (
              <textarea
                required placeholder="A family-owned bakery in Charleston WV, 12 years in business, known for real sourdough made from a starter that's older than most of our customers..."
                value={text} onChange={(e) => setText(e.target.value)}
                style={{ width: '100%', minHeight: 120, marginBottom: 18, resize: 'vertical', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'var(--fg)', padding: '12px 14px', fontSize: 15, fontFamily: 'Inter, sans-serif' }}
              />
            ) : (
              <input
                type="text" required placeholder="yourbusiness.com"
                value={url} onChange={(e) => setUrl(e.target.value)}
                onBlur={(e) => setUrl(normalizeUrl(e.target.value))}
                style={{ marginBottom: 18, height: 64, fontSize: 20, padding: '0 20px' }}
              />
            )}
            <button type="submit" className="btn-gradient" disabled={busy} style={{ width: '100%', height: 48, opacity: busy ? 0.6 : 1 }}>
              {busy ? (ingestMethod === 'text' ? 'Reading your description…' : 'Reading your site…') : 'Analyze & Continue'}
            </button>
          </form>
        </div>
      )}

      {step === 'preview' && (
        <div className="card" style={{ padding: 32 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Step 2 of 3</div>
          {busy && !firstBeat ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="dp-spinner" style={{ width: 28, height: 28, margin: '0 auto 18px' }} />
              <p style={{ color: 'var(--mist)', fontSize: 14.5 }}>{busyLabel}</p>
            </div>
          ) : firstBeat && (
            <>
              <h2 style={{ fontSize: 26, marginBottom: 18 }}>Scene 1 of your story</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 18, marginBottom: 24, alignItems: 'start' }}>
                <img src={sceneImageUrl} alt="Scene 1" style={{ width: 160, height: 160, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                <div style={{ minWidth: 0 }}>
                  <Field label="Narration" value={`"${firstBeat.phrase}"`} />
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 6 }}>
                      Narrated by Brian
                    </div>
                    <audio controls src={narratorAudioUrl} style={{ width: '100%', height: 36 }} />
                  </div>
                </div>
              </div>

              {beats.length > 1 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 10 }}>
                    How the full story unfolds ({beats.length} scenes)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {beats.map((b, i) => (
                      <div key={b.id} className="card" style={{ padding: '14px 16px', background: i === 0 ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Scene {i + 1}</span>
                          <span style={{ fontSize: 11, color: i === 0 ? 'var(--accent-solid)' : 'var(--mist)' }}>
                            {i === 0 ? 'in your free preview' : 'unlocked after generating'}
                          </span>
                        </div>
                        <div style={{ fontSize: 14, color: 'var(--fg)', marginBottom: 2 }}>"{b.phrase}"</div>
                        <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>{b.visual}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={goGenerate} className="btn-gradient" disabled={busy} style={{ width: '100%', height: 48, opacity: busy ? 0.6 : 1 }}>
                {busy ? 'One sec…' : 'Generate Full Ad & Download'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15 }}>{value}</div>
    </div>
  )
}
