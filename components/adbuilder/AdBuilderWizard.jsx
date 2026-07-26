'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { STYLE_TAGS } from '../../lib/adbuilder/styleTags.js'
import ScriptTrace from './ScriptTrace'

// Real 4-step public funnel, no login required until the very end:
// URL -> business brief -> script -> music+5s preview -> "sign up to
// finish." Each step is its own real API call (not simulated) so the
// wait is honest, not a fake progress bar.
const STEPS = ['url', 'brief', 'script', 'preview']

// Ingestion methods for step 1 - "url" and "text" are real and wired to
// /api/adbuilder/ingest today; the rest are staged/disabled so the
// chooser's real shape is visible without overcommitting scope tonight.
const INGEST_METHODS = [
  { key: 'url', label: 'Website URL', ready: true },
  { key: 'text', label: 'Describe It', ready: true },
  { key: 'photo', label: 'Upload Logo/Photo', ready: false },
  { key: 'social', label: 'Social Handle', ready: false },
]

export default function AdBuilderWizard() {
  return (
    <Suspense fallback={null}>
      <AdBuilderWizardInner />
    </Suspense>
  )
}

function AdBuilderWizardInner() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState('url')
  const [ingestMethod, setIngestMethod] = useState('url')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [brief, setBrief] = useState(null)
  const [styleTag, setStyleTag] = useState(null)
  const [script, setScript] = useState(null)
  const [scenes, setScenes] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Real friction point: typing "addiscyber.com" without a protocol is the
  // natural thing to do, but the browser's native url input (and our own
  // fetch) both need a real scheme - auto-adding https:// rather than
  // making someone retype it with the prefix.
  function normalizeUrl(value) {
    const trimmed = value.trim()
    if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
  }

  async function ingest(body) {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/adbuilder/ingest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not analyze that')
      setBrief(data.brief)
      setStep('brief')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function runIngest(e) {
    e.preventDefault()
    const normalizedUrl = normalizeUrl(url)
    const body = ingestMethod === 'text' ? { method: 'text', text: text.trim() } : { method: 'url', url: normalizedUrl }
    if (ingestMethod === 'text' ? !text.trim() : !normalizedUrl) return
    ingest(body)
  }

  // Real handoff from the homepage's own URL input (?url=...) - runs the
  // exact same ingest call automatically instead of making someone retype
  // the url they already submitted, landing straight on step 2 (brief)
  // once it resolves rather than sitting on step 1 waiting for a click.
  useEffect(() => {
    const urlParam = searchParams.get('url')
    if (!urlParam) return
    const normalized = normalizeUrl(urlParam)
    setUrl(normalized)
    ingest({ method: 'url', url: normalized })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runScript() {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/adbuilder/script', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, styleTag }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not write a script')
      setScript(data.script)
      setScenes(data.scenes)
      setStep('script')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function runPreview() {
    setBusy(true); setError(null)
    try {
      // Render scene 1's real visual specifically, so the image in the
      // free preview matches the "Scene 1" card word-for-word instead of
      // a separately-worded overall concept.
      const previewScript = { ...script, visual: scenes?.[0]?.sceneDescription || script.visual }
      const res = await fetch('/api/adbuilder/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, script: previewScript }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not render your preview')
      setPreview(data)
      setStep('preview')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Real magic-link auth means the email link very often opens in a
  // different tab than this one - sessionStorage wouldn't survive that.
  // Stash brief+script server-side first, carry only the small stashId
  // through the login/callback redirect chain instead.
  async function goFinish() {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/adbuilder/stash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, script, previewImage: preview?.imageDataUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not continue to signup')
      const finishUrl = `/adbuilder/finish?stash=${data.stashId}`

      // Real bug this fixes: this always sent an already-signed-in user
      // through the login screen again - the login/magic-link detour only
      // exists to establish a session, so skip it entirely when one's
      // already there instead of asking them to re-prove it.
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

  return (
    <div style={{ maxWidth: step === 'preview' ? 1040 : 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 36, justifyContent: 'center' }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{
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
          <div className="eyebrow" style={{ marginBottom: 14 }}>Step 1 of 4</div>
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

      {step === 'brief' && brief && (
        <div className="card" style={{ padding: 32 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Step 2 of 4</div>
          <h2 style={{ fontSize: 26, marginBottom: 18 }}>Here's what we found</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            <Field label="Business" value={brief.businessName} />
            <Field label="What you do" value={brief.whatTheyDo} />
            <Field label="Tone" value={brief.tone} />
            {brief.trustSignals?.length > 0 && <Field label="Trust signals" value={brief.trustSignals.join(', ')} />}
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 10 }}>
              Give it a style (optional)
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {STYLE_TAGS.map((t) => (
                <button
                  key={t.key} type="button" disabled={busy}
                  onClick={() => setStyleTag((cur) => (cur === t.key ? null : t.key))}
                  style={{
                    padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                    border: `1px solid ${styleTag === t.key ? 'var(--accent-solid)' : 'rgba(255,255,255,0.12)'}`,
                    background: styleTag === t.key ? 'rgba(124,58,237,0.18)' : 'transparent',
                    color: 'var(--fg)', cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={runScript} className="btn-gradient" disabled={busy} style={{ width: '100%', height: 48, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Writing your script… (~30-45s, real multi-model pass)' : 'Write My Ad Script'}
          </button>
        </div>
      )}

      {step === 'script' && script && (
        <div className="card" style={{ padding: 32 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Step 3 of 4</div>
          <h2 style={{ fontSize: 26, marginBottom: 18 }}>Your script</h2>
          <div style={{ marginBottom: 24 }}>
            <Field label="Narration (spoken across the whole ad)" value={`"${script.narration}"`} />
          </div>
          <ScriptTrace trace={script.trace} />
          {scenes?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 10 }}>
                How it breaks into {scenes.length} scenes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {scenes.map((sc, i) => (
                  <div key={i} className="card" style={{ padding: '14px 16px', background: i === 0 ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>Scene {i + 1}</span>
                      <span style={{ fontSize: 11, color: i === 0 ? 'var(--accent-solid)' : 'var(--mist)' }}>
                        {i === 0 ? 'in your free preview' : `${sc.durationSeconds || 4}s · unlocked after signup`}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--fg)' }}>{sc.sceneDescription}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={runPreview} className="btn-gradient" disabled={busy} style={{ width: '100%', height: 48, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Generating your 5s preview… (~30-60s)' : 'Generate 5s Preview'}
          </button>
        </div>
      )}

      {step === 'preview' && preview && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Step 4 of 4</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, alignItems: 'start' }}>
            {/* Left: the real rendered scene + what's behind it */}
            <div>
              <video
                src={preview.videoDataUrl} controls autoPlay muted loop playsInline
                style={{ width: '100%', borderRadius: 10, marginBottom: 16, display: 'block', background: '#000' }}
              />
              <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Narration (spoken across the whole ad)" value={`"${script.narration}"`} />
                {preview.musicPrompt && <Field label="Music" value={preview.musicPrompt} />}
              </div>
            </div>

            {/* Right: sign-up first, then the full scene list so the ask is visible without scrolling past every scene */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="card" style={{ padding: 20, background: 'rgba(124,58,237,0.08)' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Like it? This is a 5-second taste.</div>
                <div style={{ color: 'var(--mist)', fontSize: 14, marginBottom: 16 }}>Sign up free to get the full 15-30s ad, with real motion on every scene — not just a pan across one still frame.</div>
                <button
                  onClick={goFinish} disabled={busy}
                  className="btn-gradient" style={{ display: 'block', width: '100%', textAlign: 'center', height: 48, opacity: busy ? 0.6 : 1 }}
                >
                  {busy ? 'One sec…' : 'Create the Full Ad'}
                </button>
              </div>

              {(scenes?.length ? scenes : [{ sceneDescription: script.visual, durationSeconds: 5 }]).map((sc, i) => (
                <div key={i} className="card" style={{ padding: 14, display: 'flex', gap: 12 }}>
                  {i === 0 ? (
                    <img src={preview.imageDataUrl} alt="Scene 1" style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{
                      width: 72, height: 72, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.03) 8px, rgba(255,255,255,0.06) 8px, rgba(255,255,255,0.06) 16px)',
                    }}>
                      <span style={{ fontSize: 18 }}>🔒</span>
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>Scene {i + 1}</span>
                      <span style={{ fontSize: 11, color: i === 0 ? 'var(--accent-solid)' : 'var(--mist)', whiteSpace: 'nowrap' }}>
                        {i === 0 ? 'free preview' : `${sc.durationSeconds || 4}s`}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--mist)', lineHeight: 1.4 }}>{sc.sceneDescription}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
