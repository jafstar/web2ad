'use client'

import { useEffect, useRef, useState } from 'react'
import MusicEditor from './MusicEditor'

// Real adaptation of rescript-studio's proven shot-card pattern (a local
// GUI built for editing AI-generated movie shots) for web2ad's hosted,
// multi-tenant ad pipeline. Same core idea, carried over deliberately:
// plain-language "fix the image" / "fix the motion" boxes instead of a
// timeline a non-technical user would have to learn.
// Real, live-confirmed heuristic (2026-07-25): a full run came in "under
// about 5 minutes" - shots render in parallel (see runShotGeneration), so
// total wall-clock time doesn't scale with shot count, just one estimate
// for the whole run. This is NOT real telemetry from Hailuo/Flux (their
// APIs expose no percent/progress field, confirmed against MiniMax's own
// docs) - it's a guess dressed up as a progress bar, capped short of 100%
// so it never claims to be done before the real status says so.
const ESTIMATED_TOTAL_MS = 4.5 * 60 * 1000

export default function ShotReview({ runId, initialSchema }) {
  const [schema, setSchema] = useState(initialSchema)
  const [busyShot, setBusyShot] = useState(null) // shotId currently regenerating
  const [now, setNow] = useState(() => Date.now())
  const pollRef = useRef(null)
  const tickRef = useRef(null)

  const stillGenerating = schema.shots.some((s) => s.status === 'pending' || s.status === 'keyframe-done')

  useEffect(() => {
    if (!stillGenerating) return
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/adbuilder/run/${runId}`)
      const data = await res.json()
      if (res.ok) setSchema(data.schema)
    }, 3000)
    return () => clearInterval(pollRef.current)
  }, [stillGenerating, runId])

  useEffect(() => {
    if (!stillGenerating) return
    tickRef.current = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tickRef.current)
  }, [stillGenerating])

  const elapsedMs = now - (schema.createdAt || now)
  const estimatedPct = Math.min(95, Math.round((elapsedMs / ESTIMATED_TOTAL_MS) * 100))

  async function callAction(path, body) {
    setBusyShot(body.shotId)
    try {
      const res = await fetch(`/api/adbuilder/run/${runId}/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'That action failed')
      setSchema(data.schema)
    } catch (err) {
      alert(err.message)
    } finally {
      setBusyShot(null)
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {stillGenerating && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--mist)', marginBottom: 6 }}>
            <span>Generating your full ad… (real shots landing on the right as they finish)</span>
            <span>~{estimatedPct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${estimatedPct}%`, background: 'var(--accent-gradient)', transition: 'width 1s linear' }} />
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24, alignItems: 'start' }}>
        {/* Left: the video + music - stays put while shots scroll on the right */}
        <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <ExportSection runId={runId} schema={schema} />
          <MusicEditor runId={runId} schema={schema} onChosen={(filename) => setSchema((s) => ({ ...s, chosenMusic: filename }))} />
        </div>

        {/* Right: every shot, scrolls independently of the left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {schema.shots.map((shot) => (
            <ShotCard
              key={shot.id}
              runId={runId}
              shot={shot}
              busy={busyShot === shot.id}
              onPatchKeyframe={(fixNote) => callAction('patch-keyframe', { shotId: shot.id, fixNote })}
              onPatchMotion={(fixNote) => callAction('patch-motion', { shotId: shot.id, fixNote })}
              onToggle={() => callAction('toggle-shot', { shotId: shot.id })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// The real terminal step - everything above only generates/patches
// individual shots and a music option, nothing stitches them together
// until this runs. Re-exporting is always available so a later fix to a
// shot or a new music choice can be baked into the final file again.
function ExportSection({ runId, schema }) {
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(!!schema.export)
  const [error, setError] = useState(null)
  const doneCount = schema.shots.filter((s) => !s.disabled && s.status === 'done').length
  // A failed shot that's still enabled would just get silently skipped by
  // the export (it only ever stitches status==='done' shots) - block
  // export instead of shipping a gap the user didn't consciously choose.
  // Disabling the shot (an explicit choice) or fixing it both clear this.
  const hasUnresolvedFailure = schema.shots.some((s) => !s.disabled && s.status === 'error')

  async function doExport() {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/adbuilder/run/${runId}/export`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not export your ad')
      setReady(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Final Step</div>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Export your full ad for {schema.brief.businessName}</h2>
      {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {hasUnresolvedFailure && (
        <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>
          A shot failed and is still enabled — fix it, retry it, or click Disable on it before exporting.
        </div>
      )}
      {ready ? (
        <>
          <video
            key={busy ? 'refreshing' : 'ready'}
            src={`/api/adbuilder/run/${runId}/export`} controls
            style={{ width: '100%', borderRadius: 10, marginBottom: 14, display: 'block', background: '#000' }}
          />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={`/api/adbuilder/run/${runId}/export`} download="ad.mp4" target="_blank" rel="noopener" className="btn-gradient" style={{ padding: '11px 22px', textDecoration: 'none' }}>Download</a>
            <button type="button" onClick={doExport} disabled={busy || hasUnresolvedFailure} className="btn-ghost" style={{ fontSize: 13, opacity: hasUnresolvedFailure ? 0.5 : 1 }}>
              {busy ? 'Re-exporting…' : 'Re-export (picks up any changes)'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ color: 'var(--mist)', fontSize: 14, marginBottom: 16 }}>
            Stitches your {doneCount} finished shot{doneCount === 1 ? '' : 's'} together with narration and music into one real video.
          </p>
          <button
            type="button" onClick={doExport} disabled={busy || doneCount === 0 || hasUnresolvedFailure}
            className="btn-gradient" style={{ width: '100%', height: 48, opacity: busy || doneCount === 0 || hasUnresolvedFailure ? 0.6 : 1 }}
          >
            {busy ? 'Exporting… (~30-60s)' : 'Export My Ad'}
          </button>
        </>
      )}
    </div>
  )
}

function ShotCard({ runId, shot, busy, onPatchKeyframe, onPatchMotion, onToggle }) {
  const generating = shot.status === 'pending' || shot.status === 'keyframe-done'
  const hasRender = shot.status === 'done' || shot.status === 'error'
  const canFixMotion = shot.status === 'done' || shot.status === 'error'
  // Real, live-found UX problem: two always-visible textareas (image fix +
  // motion fix) side by side reads as "pick both" when really only one
  // ever applies at a time - a shot that failed at the motion step (image
  // was fine) only ever needs "Fix Motion," but showed an equally-weighted
  // "Fix Image" box right next to it with no signal which one to use.
  // Single toggle instead, defaulting to whichever mode a failure implies.
  const [mode, setMode] = useState(shot.status === 'error' && canFixMotion ? 'motion' : 'image')
  const [fixNote, setFixNote] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const keyframeUrl = `/api/adbuilder/run/${runId}/media?type=keyframe&shotId=${shot.id}`
  const renderUrl = `/api/adbuilder/run/${runId}/media?type=render&shotId=${shot.id}`

  function submitFix() {
    if (mode === 'image') onPatchKeyframe(fixNote)
    else onPatchMotion(fixNote)
    setFixNote('')
  }

  return (
    <div className="card" style={{ padding: 20, opacity: shot.disabled ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Shot {shot.id}</span>
        <span style={{ fontSize: 12, color: 'var(--mist)' }}>{shot.durationSeconds}s</span>
        {shot.disabled && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(224,100,90,0.15)', color: 'var(--danger)' }}>disabled</span>}
        <button
          type="button" onClick={onToggle} disabled={busy}
          className="btn-ghost" style={{ marginLeft: 'auto', fontSize: 12.5 }}
        >
          {shot.disabled ? 'Re-enable' : 'Disable'}
        </button>
      </div>

      {(busy || generating) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(56,189,248,0.08)', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13, color: 'var(--blue-glow)' }}>
          <div className="dp-spinner" style={{ width: 14, height: 14 }} />
          {generating ? 'Generating…' : 'Updating…'}
        </div>
      )}

      {shot.status === 'error' && (
        <div style={{ background: 'rgba(224,100,90,0.1)', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13, color: 'var(--danger)' }}>
          Failed: {shot.error}
          {canFixMotion && ' — the image rendered fine, so Fix Motion below will just retry the render.'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 18 }}>
        <div>
          {hasRender && shot.status === 'done' ? (
            <video src={renderUrl} muted loop autoPlay playsInline style={{ width: '100%', borderRadius: 8, display: 'block', background: '#000' }} />
          ) : shot.status === 'pending' ? (
            <div style={{
              width: '100%', aspectRatio: '1', borderRadius: 8,
              background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.04) 10px, rgba(255,255,255,0.08) 10px, rgba(255,255,255,0.08) 20px)',
            }} />
          ) : (
            <img src={keyframeUrl} alt={`Shot ${shot.id}`} style={{ width: '100%', borderRadius: 8, display: 'block', background: '#000', aspectRatio: '1' }} onError={(e) => { e.target.style.visibility = 'hidden' }} />
          )}
        </div>

        <div>
          <p style={{ fontSize: 14, color: 'var(--mist)', marginBottom: 14, lineHeight: 1.5 }}>{shot.sceneDescription}</p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, opacity: busy ? 0.5 : 1 }}>
            <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden' }}>
              <button
                type="button" onClick={() => setMode('image')} disabled={busy || generating}
                style={{
                  padding: '6px 14px', fontSize: 12.5, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  background: mode === 'image' ? 'rgba(124,58,237,0.22)' : 'transparent', color: 'var(--fg)',
                }}
              >
                Fix Image
              </button>
              <button
                type="button" onClick={() => setMode('motion')} disabled={busy || generating || !canFixMotion}
                title={canFixMotion ? undefined : 'Available once this shot has a real image to animate'}
                style={{
                  padding: '6px 14px', fontSize: 12.5, border: 'none', fontFamily: 'Inter, sans-serif',
                  cursor: canFixMotion ? 'pointer' : 'not-allowed',
                  background: mode === 'motion' ? 'rgba(124,58,237,0.22)' : 'transparent',
                  color: canFixMotion ? 'var(--fg)' : 'var(--mist)',
                }}
              >
                Fix Motion
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <button
                type="button" onClick={() => setShowInfo((v) => !v)} aria-label="What's the difference?"
                style={{
                  width: 18, height: 18, borderRadius: '50%', border: '1px solid var(--mist)', background: 'none',
                  color: 'var(--mist)', fontSize: 11, lineHeight: 1, cursor: 'pointer', padding: 0,
                }}
              >
                i
              </button>
              {showInfo && (
                <div className="card" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 230, zIndex: 5, padding: 12, fontSize: 12, lineHeight: 1.5 }}>
                  <strong>Fix Image</strong> regenerates the photo and re-renders motion from it — use for lighting, composition, what's in frame.<br /><br />
                  <strong>Fix Motion</strong> keeps the same photo, only changes the camera move or action.
                </div>
              )}
            </div>
          </div>

          <textarea
            rows={2} value={fixNote} onChange={(e) => setFixNote(e.target.value)}
            placeholder={mode === 'image' ? 'e.g. brighter lighting, technician facing camera' : 'e.g. hold mostly still, slow pan only'}
            disabled={busy || generating || (mode === 'motion' && !canFixMotion)}
            style={{ width: '100%', fontSize: 13, marginBottom: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'var(--fg)', padding: '8px 10px', fontFamily: 'Inter, sans-serif', resize: 'vertical', opacity: busy ? 0.5 : 1 }}
          />
          <button
            type="button" disabled={busy || generating || (mode === 'motion' && !canFixMotion)}
            onClick={submitFix}
            className="btn-ghost" style={{ fontSize: 12.5, opacity: busy ? 0.5 : 1 }}
          >
            {mode === 'image' ? 'Regenerate image + re-render' : 'Re-render motion only'}
          </button>
        </div>
      </div>
    </div>
  )
}
