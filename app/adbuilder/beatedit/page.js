'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import SiteHeader from '../../../components/SiteHeader'

// The real "paid" edit surface, per 2026-07-26's design: a forked v2 ad
// (see beatedit/fork/route.js) lands here instead of the free flow's
// read-only beatfinish view. Regenerates ONE beat's image/motion at a
// time (same real Flux/Hailuo calls, just scoped per-beat) then
// re-composites with the beat pipeline's own precise phrase-timed
// compositor - never routes through v1's cruder single-narration-block
// export, so an edited ad never regresses the pacing quality that was
// the whole point of building the beat pipeline.
function BeatEditInner() {
  const searchParams = useSearchParams()
  const runId = searchParams.get('run')
  const [project, setProject] = useState(null)
  const [error, setError] = useState(null)
  const [busyBeatId, setBusyBeatId] = useState(null)
  const [busyAction, setBusyAction] = useState(null)
  const [rendering, setRendering] = useState(false)

  async function loadProject() {
    try {
      const res = await fetch('/api/adbuilder/projects')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load your ads')
      const proj = data.projects?.find((p) => p.data?.v2 && p.data?.editable && p.data?.runId === runId)
      if (!proj) throw new Error('Could not find that editable ad')
      setProject(proj)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    if (!runId) { setError('Missing ad id — open this from My Ads.'); return }
    loadProject()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  async function regenImage(beatId, fixNote, referenceImageDataUrl) {
    setBusyBeatId(beatId); setBusyAction('image'); setError(null)
    try {
      const res = await fetch('/api/adbuilder/beatedit/keyframe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, beatId, fixNote, referenceImageDataUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not regenerate that image')
      await loadProject()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyBeatId(null); setBusyAction(null)
    }
  }

  async function savePhrase(beatId, phrase) {
    setBusyBeatId(beatId); setBusyAction('phrase'); setError(null)
    try {
      const res = await fetch('/api/adbuilder/beatedit/phrase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, beatId, phrase }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save that narration')
      await loadProject()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyBeatId(null); setBusyAction(null)
    }
  }

  async function regenMotion(beatId) {
    setBusyBeatId(beatId); setBusyAction('motion'); setError(null)
    try {
      const res = await fetch('/api/adbuilder/beatedit/motion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, beatId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not regenerate that clip')
      await loadProject()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyBeatId(null); setBusyAction(null)
    }
  }

  async function reRender() {
    setRendering(true); setError(null)
    try {
      const res = await fetch('/api/adbuilder/beatedit/render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not re-render this ad')
      await loadProject()
    } catch (err) {
      setError(err.message)
    } finally {
      setRendering(false)
    }
  }

  if (error && !project) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <SiteHeader />
        <div style={{ padding: '56px 32px 100px', textAlign: 'center' }}>
          <div className="card" style={{ maxWidth: 480, margin: '80px auto', padding: 24, borderColor: 'var(--danger)' }}>
            <span style={{ color: 'var(--danger)' }}>{error}</span>
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <SiteHeader />
        <div style={{ textAlign: 'center', maxWidth: 480, margin: '120px auto' }}>
          <div className="dp-spinner" style={{ width: 32, height: 32, margin: '0 auto 20px' }} />
        </div>
      </div>
    )
  }

  const beats = project.data.beats
  const allReady = beats.every((b) => b.renderUrl)

  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <div style={{ padding: '56px 32px 100px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Editing (fork)</div>
          <h1 style={{ fontSize: 28, marginBottom: 24 }}>{project.data.businessName}</h1>

          {error && (
            <div className="card" style={{ padding: 16, marginBottom: 20, borderColor: 'var(--danger)' }}>
              <span style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</span>
            </div>
          )}

          <div className="card" style={{ padding: 20, marginBottom: 28 }}>
            <video
              key={project.data.videoUrl} src={project.data.videoUrl} controls playsInline
              style={{ width: '100%', borderRadius: 10, marginBottom: 16, display: 'block', background: '#000' }}
            />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={reRender} disabled={rendering || !allReady} className="btn-gradient" style={{ flex: 1, minWidth: 200, height: 44, opacity: rendering || !allReady ? 0.6 : 1 }}>
                {rendering ? 'Re-rendering… (~1-2 min)' : allReady ? 'Re-render Ad With Edits' : 'Finish pending beats to re-render'}
              </button>
              <a href={project.data.videoUrl} download="ad.mp4" className="btn-ghost" style={{ display: 'flex', alignItems: 'center', padding: '0 18px', height: 44, textDecoration: 'none' }}>
                Download Current
              </a>
            </div>
          </div>

          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 12 }}>
            {beats.length} beats
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {beats.map((beat) => (
              <BeatRow
                key={beat.id}
                beat={beat}
                busy={busyBeatId === beat.id ? busyAction : null}
                onRegenImage={(fixNote, referenceImageDataUrl) => regenImage(beat.id, fixNote, referenceImageDataUrl)}
                onRegenMotion={() => regenMotion(beat.id)}
                onSavePhrase={(phrase) => savePhrase(beat.id, phrase)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Downscales an uploaded photo client-side before it ever becomes a data
// URL - a phone photo can be 4-8MB, well past what's needed for a Flux
// reference image and close to Vercel's request body limit. 1024px on the
// long edge matches the keyframe generation size elsewhere in this
// pipeline, so there's no real quality left on the table.
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

function BeatRow({ beat, busy, onRegenImage, onRegenMotion, onSavePhrase }) {
  const [fixNote, setFixNote] = useState('')
  const [referencePreview, setReferencePreview] = useState(null)
  const [referenceError, setReferenceError] = useState(null)
  const [phrase, setPhrase] = useState(beat.phrase)
  const phraseDirty = phrase.trim() !== beat.phrase
  useEffect(() => { setPhrase(beat.phrase) }, [beat.phrase])

  async function handleReferenceUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setReferenceError(null)
    try {
      const dataUrl = await resizeImageFile(file)
      setReferencePreview(dataUrl)
    } catch (err) {
      setReferenceError(err.message)
    }
  }

  return (
    <div className="card" style={{ padding: 18, display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16 }}>
      {beat.keyframeUrl ? (
        <img src={beat.keyframeUrl} alt={`Beat ${beat.id}`} style={{ width: 120, height: 120, borderRadius: 8, objectFit: 'cover' }} />
      ) : (
        <div style={{ width: 120, height: 120, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }} />
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Beat {beat.id}</span>
          <span style={{ fontSize: 11, color: beat.renderUrl ? '#4ade80' : '#fbbf24' }}>
            {beat.renderUrl ? 'clip ready' : 'needs motion'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
          <textarea
            value={phrase} onChange={(e) => setPhrase(e.target.value)}
            rows={1} style={{ flex: 1, fontSize: 14, resize: 'vertical', minHeight: 30, padding: '5px 8px', background: phraseDirty ? 'rgba(124,58,237,0.08)' : 'transparent', border: `1px solid ${phraseDirty ? 'var(--accent-solid)' : 'transparent'}`, borderRadius: 6, color: 'var(--fg)', fontFamily: 'inherit' }}
          />
          {phraseDirty && (
            <button onClick={() => onSavePhrase(phrase.trim())} disabled={busy === 'phrase'} className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11.5, whiteSpace: 'nowrap' }}>
              {busy === 'phrase' ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--mist)', marginBottom: 10 }}>{beat.visual}</div>

        <input
          type="text" placeholder='Optional fix note (e.g. "more natural lighting")'
          value={fixNote} onChange={(e) => setFixNote(e.target.value)}
          style={{ width: '100%', height: 34, fontSize: 13, padding: '0 10px', marginBottom: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'var(--fg)' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          {referencePreview && (
            <img src={referencePreview} alt="Your reference photo" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover' }} />
          )}
          <label className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
            {referencePreview ? 'Change your photo' : 'Use your own photo as reference'}
            <input type="file" accept="image/*" onChange={handleReferenceUpload} style={{ display: 'none' }} />
          </label>
          {referencePreview && (
            <button onClick={() => setReferencePreview(null)} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}>Clear</button>
          )}
        </div>
        {referenceError && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{referenceError}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onRegenImage(fixNote, referencePreview)} disabled={!!busy} className="btn-ghost" style={{ padding: '6px 14px', fontSize: 12.5, opacity: busy ? 0.6 : 1 }}>
            {busy === 'image' ? 'Regenerating…' : 'Regenerate Image'}
          </button>
          <button onClick={onRegenMotion} disabled={!!busy || !beat.keyframeUrl} className="btn-ghost" style={{ padding: '6px 14px', fontSize: 12.5, opacity: busy || !beat.keyframeUrl ? 0.6 : 1 }}>
            {busy === 'motion' ? 'Regenerating…' : 'Regenerate Motion'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BeatEditPage() {
  return (
    <Suspense fallback={null}>
      <BeatEditInner />
    </Suspense>
  )
}
