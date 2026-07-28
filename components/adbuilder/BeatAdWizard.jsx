'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import StoryboardPlayer from './StoryboardPlayer'

// Real 3-step v2 funnel - url -> theme/script/character reference (2a) ->
// full storyboard preview (2b) -> generate the full ad + download.
// Step 2 split into 2a/2b live 2026-07-28: 2a is Gemini pitching 3-4
// distinct story angles ("let it loose by itself, no council no editor" -
// one model, no multi-step critique cycle), the business owner picking
// one, editing the resulting script, and optionally anchoring the whole
// story to one uploaded character/product photo - all cheap, text/one-
// photo-only. 2b (StoryboardPlayer) is what used to be the whole of step
// 2: real images+narration+music for every beat, still free, still no
// Hailuo motion. v1 (components/adbuilder/AdBuilderWizard.jsx) is
// untouched and still lives at /adbuilder/classic.
const DOT_INDEX = { url: 0, theme: 1, script: 1, preview: 1 }
const STEP_LABEL = { url: 'Step 1 of 3', theme: 'Step 2a of 3', script: 'Step 2a of 3', preview: 'Step 2b of 3' }

const INGEST_METHODS = [
  { key: 'url', label: 'Website URL', ready: true },
  { key: 'text', label: 'Describe It', ready: true },
  { key: 'photo', label: 'Upload Logo/Photo', ready: false },
  { key: 'social', label: 'Social Handle', ready: false },
]

// Downscales an uploaded photo client-side before it becomes a data URL -
// same helper beatedit/page.js uses for its per-beat reference upload,
// duplicated locally rather than shared since it's ~15 lines and this
// wizard has no shared-utils import today.
function resizeImageFile(file, maxDim = 1024, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('Could not read that image'))
    img.src = URL.createObjectURL(file)
  })
}

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
  const [direction, setDirection] = useState('')
  const [brief, setBrief] = useState(null)
  const [themes, setThemes] = useState(null)
  const [editableBeats, setEditableBeats] = useState(null)
  const [referencePreview, setReferencePreview] = useState(null)
  const [referenceError, setReferenceError] = useState(null)
  const [beats, setBeats] = useState(null)
  const [atmosphere, setAtmosphere] = useState(null)
  const [musicDataUrl, setMusicDataUrl] = useState(null)
  const [totalDuration, setTotalDuration] = useState(null)
  const [outroEnabled, setOutroEnabled] = useState(true)
  const [outroText, setOutroText] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')
  const [error, setError] = useState(null)

  function normalizeUrl(value) {
    const trimmed = value.trim()
    if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
  }

  // Step 1 -> 2a part 1: ingest, then pitch 3-4 story angles. Moving to
  // 'theme' immediately lets the loading state render in that step's
  // slot instead of sitting on step 1.
  async function ingestAndPitch(body) {
    setBusy(true); setError(null); setStep('theme')
    try {
      setBusyLabel(body.method === 'text' ? 'Reading your description…' : 'Reading your site…')
      const ingestRes = await fetch('/api/adbuilder/ingest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const ingestData = await ingestRes.json()
      if (!ingestRes.ok) throw new Error(ingestData.error || 'Could not analyze that')
      setBrief(ingestData.brief)
      // Pre-fill the outro text with whatever real mascot/character we
      // actually detected on their site (docs/real-footage-sourcing.md /
      // brandExtract.js) - a real starting point to confirm or edit, not
      // a blank field they have to fill from scratch.
      if (ingestData.brief.mascotNote) setOutroText(ingestData.brief.mascotNote)

      setBusyLabel('Pitching a few story angles… (~10-15s)')
      const pitchRes = await fetch('/api/adbuilder/pitchthemes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: ingestData.brief, direction }),
      })
      const pitchData = await pitchRes.json()
      if (!pitchRes.ok) throw new Error(pitchData.error || 'Could not pitch story ideas')
      setThemes(pitchData.themes)
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
    ingestAndPitch(body)
  }

  useEffect(() => {
    const urlParam = searchParams.get('url')
    if (!urlParam) return
    const normalized = normalizeUrl(urlParam)
    setUrl(normalized)
    ingestAndPitch({ method: 'url', url: normalized })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2a part 2: the chosen theme becomes the `direction` fed into
  // writeAdBeats (same mechanism the free-text field already uses) -
  // combined with whatever the business owner typed on step 1, so both
  // apply together rather than the theme silently overriding it.
  async function chooseTheme(theme) {
    setBusy(true); setError(null); setStep('script')
    try {
      setBusyLabel('Writing the full script for this angle… (~10-20s)')
      const combinedDirection = [direction, `Chosen story angle: "${theme.title}" - ${theme.pitch}`].filter(Boolean).join('\n\n')
      const res = await fetch('/api/adbuilder/writebeats', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, direction: combinedDirection }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not write the script')
      setEditableBeats(data.beats)
      setAtmosphere(data.atmosphere)
    } catch (err) {
      setError(err.message)
      setStep('theme')
    } finally {
      setBusy(false)
    }
  }

  function updateBeatField(index, field, value) {
    setEditableBeats((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)))
  }

  async function handleReferenceUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setReferenceError(null)
    try {
      setReferencePreview(await resizeImageFile(file))
    } catch (err) {
      setReferenceError(err.message)
    }
  }

  // 2a -> 2b: build the real storyboard preview from the (possibly
  // edited) script, anchored to the reference photo if one was uploaded.
  async function continueToPreview() {
    setBusy(true); setError(null); setStep('preview')
    try {
      setBusyLabel('Rendering every scene… (~45-90s, no video yet — that\'s the paid step)')
      const res = await fetch('/api/adbuilder/storyboardpreview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, beats: editableBeats, atmosphere, referenceImageDataUrl: referencePreview }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not build your preview')
      setBeats(data.beats)
      setAtmosphere(data.atmosphere)
      setMusicDataUrl(data.musicDataUrl)
      setTotalDuration(data.totalDuration)
    } catch (err) {
      setError(err.message)
      setStep('script')
    } finally {
      setBusy(false)
    }
  }

  // Same stash-then-redirect pattern as v1's goFinish: a magic-link email
  // very often opens in a different tab, so the brief+beats need to
  // survive server-side, keyed by a short id, rather than living in
  // sessionStorage. /api/adbuilder/stash is fully reused as-is - its
  // `script` column is a generic jsonb blob, so it holds v2's beat shape
  // here just as happily as v1's script shape.
  async function goGenerate() {
    setBusy(true); setError(null)
    try {
      const briefWithOutro = {
        ...brief,
        outroEnabled, outroText: outroEnabled ? outroText.trim() : '',
        // Carried into the real paid generation too, so the reference
        // photo anchors the final video the same way it anchored this
        // free preview - see generateBeatShots/buildBeatAd.
        referenceImageDataUrl: referencePreview || null,
      }
      const sceneImageUrl = beats?.[0]?.keyframeUrl || null
      // The real generation step re-synthesizes audio and re-generates
      // keyframes fresh from phrase/visual (see buildBeatAd/composeBeatAd)
      // - it never reads this preview's keyframeUrl/audioDataUrl, so
      // there's no reason to carry those large base64 audio blobs into
      // the stash row.
      const leanBeats = beats.map(({ id, phrase, visual }) => ({ id, phrase, visual }))
      const res = await fetch('/api/adbuilder/stash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: briefWithOutro, script: { mode: 'beat', beats: leanBeats, atmosphere, sceneImageUrl }, previewImage: null }),
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

  const dotIndex = DOT_INDEX[step] ?? 0
  const firstBeat = beats?.[0]

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 36, justifyContent: 'center' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 44, height: 4, borderRadius: 2,
            background: i <= dotIndex ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.12)',
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
          <div className="eyebrow" style={{ marginBottom: 14 }}>{STEP_LABEL.url}</div>
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

            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 8 }}>
              What do you want to see made? (optional)
            </div>
            <textarea
              placeholder='e.g. "end with our cowboy mascot and our phone number" or "keep it fast-paced, no slow shots"'
              value={direction} onChange={(e) => setDirection(e.target.value)}
              style={{ width: '100%', minHeight: 64, marginBottom: 18, resize: 'vertical', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'var(--fg)', padding: '10px 14px', fontSize: 14, fontFamily: 'Inter, sans-serif' }}
            />

            <button type="submit" className="btn-gradient" disabled={busy} style={{ width: '100%', height: 48, opacity: busy ? 0.6 : 1 }}>
              {busy ? (ingestMethod === 'text' ? 'Reading your description…' : 'Reading your site…') : 'Analyze & Continue'}
            </button>
          </form>
        </div>
      )}

      {step === 'theme' && (
        <div className="card" style={{ padding: 32 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>{STEP_LABEL.theme}</div>
          {busy || !themes ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="dp-spinner" style={{ width: 28, height: 28, margin: '0 auto 18px' }} />
              <p style={{ color: 'var(--mist)', fontSize: 14.5 }}>{busyLabel}</p>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 26, marginBottom: 6 }}>Pick a story angle</h2>
              <p style={{ color: 'var(--mist)', fontSize: 13.5, marginBottom: 22 }}>A few genuinely different directions for {brief?.businessName}'s ad.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {themes.map((t, i) => (
                  <button
                    key={i} onClick={() => chooseTheme(t)}
                    className="card"
                    style={{ padding: 18, textAlign: 'left', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <div style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 6 }}>{t.title}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--mist)', lineHeight: 1.5 }}>{t.pitch}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {step === 'script' && (
        <div className="card" style={{ padding: 32 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>{STEP_LABEL.script}</div>
          {busy || !editableBeats ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="dp-spinner" style={{ width: 28, height: 28, margin: '0 auto 18px' }} />
              <p style={{ color: 'var(--mist)', fontSize: 14.5 }}>{busyLabel}</p>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 26, marginBottom: 6 }}>Your script</h2>
              <p style={{ color: 'var(--mist)', fontSize: 13.5, marginBottom: 20 }}>Edit any line, or anchor the whole story to a real photo, before we render it.</p>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Character / product reference (optional)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {referencePreview && <img src={referencePreview} alt="Reference" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />}
                  <label className="btn-ghost" style={{ padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>
                    {referencePreview ? 'Change photo' : 'Upload a real photo'}
                    <input type="file" accept="image/*" onChange={handleReferenceUpload} style={{ display: 'none' }} />
                  </label>
                  {referencePreview && (
                    <button onClick={() => setReferencePreview(null)} className="btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }}>Clear</button>
                  )}
                </div>
                {referenceError && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{referenceError}</div>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {editableBeats.map((b, i) => (
                  <div key={b.id} className="card" style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Scene {i + 1}</div>
                    <textarea
                      value={b.phrase} onChange={(e) => updateBeatField(i, 'phrase', e.target.value)}
                      rows={1} style={{ width: '100%', fontSize: 14, resize: 'vertical', minHeight: 30, padding: '5px 8px', marginBottom: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'var(--fg)', fontFamily: 'inherit' }}
                    />
                    <textarea
                      value={b.visual} onChange={(e) => updateBeatField(i, 'visual', e.target.value)}
                      rows={1} style={{ width: '100%', fontSize: 12.5, resize: 'vertical', minHeight: 26, padding: '5px 8px', background: 'transparent', border: '1px solid transparent', borderRadius: 6, color: 'var(--mist)', fontFamily: 'inherit' }}
                    />
                  </div>
                ))}
              </div>

              <button onClick={continueToPreview} className="btn-gradient" disabled={busy} style={{ width: '100%', height: 48, opacity: busy ? 0.6 : 1 }}>
                {busy ? 'One sec…' : 'Render Scene Preview'}
              </button>
            </>
          )}
        </div>
      )}

      {step === 'preview' && (
        <div className="card" style={{ padding: 32 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>{STEP_LABEL.preview}</div>
          {busy && !firstBeat ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="dp-spinner" style={{ width: 28, height: 28, margin: '0 auto 18px' }} />
              <p style={{ color: 'var(--mist)', fontSize: 14.5 }}>{busyLabel}</p>
            </div>
          ) : firstBeat && (
            <>
              <h2 style={{ fontSize: 26, marginBottom: 6 }}>Your full story, in preview</h2>
              <p style={{ color: 'var(--mist)', fontSize: 13.5, marginBottom: 18 }}>
                Every scene's real image and narration, free — the video motion is the one paid step, right after this.
              </p>
              <div style={{ marginBottom: 24 }}>
                <StoryboardPlayer beats={beats} musicDataUrl={musicDataUrl} totalDuration={totalDuration} />
              </div>

              <div className="card" style={{ padding: '16px 18px', marginBottom: 20, background: 'rgba(255,255,255,0.02)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: outroEnabled ? 12 : 0 }}>
                  <input type="checkbox" checked={outroEnabled} onChange={(e) => setOutroEnabled(e.target.checked)} style={{ width: 16, height: 16 }} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Add a branded ending</span>
                </label>
                {outroEnabled && (
                  <>
                    <div style={{ fontSize: 12.5, color: 'var(--mist)', marginBottom: 8 }}>
                      Your business name{brief?.phoneNumber ? ' and phone number' : ''} on a closing card, in your real site colors.
                    </div>
                    <textarea
                      placeholder="Optional tagline or description (e.g. a mascot or character to mention)"
                      value={outroText} onChange={(e) => setOutroText(e.target.value)}
                      style={{ width: '100%', minHeight: 50, resize: 'vertical', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'var(--fg)', padding: '8px 12px', fontSize: 13, fontFamily: 'Inter, sans-serif' }}
                    />
                  </>
                )}
              </div>

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
