'use client'

import { useEffect, useState } from 'react'
import SiteHeader from '../../../components/SiteHeader'
import ScriptTrace from '../../../components/adbuilder/ScriptTrace'
import { STYLE_TAGS } from '../../../lib/adbuilder/styleTags.js'

// Real, existing pattern reused rather than invented fresh - the leftover
// genstock photo tool already has a heart-icon favorite/"Lightbox"
// mechanism (RoundThumbGrid.jsx + LightboxSection.jsx). Same idea here,
// scoped to scripts only, stored locally since this is a personal debug
// tool with no need for backend plumbing.
const FAVORITES_KEY = 'web2ad_playground_script_favorites'

function loadFavoritesFromStorage() {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]') } catch { return [] }
}

// Real debug tool - test the Council script writer, Flux ref-image
// generation, and music generation in isolation, without running the
// whole free-preview funnel each time. Direct answer to "how do we debug
// this well" - every intermediate step (draft/refine/critiques) is shown,
// not just the final output.
export default function PlaygroundPage() {
  const [tab, setTab] = useState('scripts') // 'scripts' | 'images' | 'music'

  // Script state lives here (not inside a child component) so the inputs
  // and the results can sit in separate grid columns while still sharing
  // one source of truth.
  const [mode, setMode] = useState('url') // 'url' | 'manual' - url mimics the real wizard's ingest step
  const [url, setUrl] = useState('')
  const [ingestBusy, setIngestBusy] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [whatTheyDo, setWhatTheyDo] = useState('')
  const [tone, setTone] = useState('')
  const [trustSignals, setTrustSignals] = useState('')
  // Real vertical routing built 2026-07-26 - auto-detected during ingest
  // (same call that extracts businessName/whatTheyDo), drives a STRONG
  // DEFAULT for shot framing + comedic register downstream (see
  // lib/adbuilder/verticals.js), never a hard wall - editable here same
  // as any other field.
  const [vertical, setVertical] = useState('general')
  const [styleTag, setStyleTag] = useState(null)
  // Real, separate "writer room" pipeline requested live 2026-07-26 - two
  // calls (a single writer pitches, Claude edits/adds scenery) instead of
  // the full 6-call Council above, specifically so different writer/tone
  // combos are fast enough to actually A/B here. 'council' keeps today's
  // existing behavior (styleTag + 4-voice critique) completely untouched.
  const [pipeline, setPipeline] = useState('council') // 'council' | 'fast'
  const [pipelineTone, setPipelineTone] = useState('professional')
  const [writer, setWriter] = useState('gemini') // 'gemini' | 'grok'
  const [scriptBusy, setScriptBusy] = useState(false)
  const [scriptError, setScriptError] = useState(null)
  const [script, setScript] = useState(null)
  const [favorites, setFavorites] = useState([])

  useEffect(() => { setFavorites(loadFavoritesFromStorage()) }, [])

  function saveFavorite() {
    if (!script) return
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: Date.now(),
      businessName, whatTheyDo, tone, trustSignals, styleTag, script,
    }
    const next = [entry, ...favorites]
    setFavorites(next)
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
  }

  function removeFavorite(id) {
    const next = favorites.filter((f) => f.id !== id)
    setFavorites(next)
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
  }

  // Reloads a favorite back into the inputs and shows its saved result -
  // deliberately NOT launching a real run, just a quick way to revisit or
  // tweak a good test.
  function loadFavorite(fav) {
    setBusinessName(fav.businessName || '')
    setWhatTheyDo(fav.whatTheyDo || '')
    setTone(fav.tone || '')
    setTrustSignals(fav.trustSignals || '')
    setStyleTag(fav.styleTag || null)
    setScript(fav.script)
    setScriptError(null)
  }

  function normalizeUrl(value) {
    const trimmed = value.trim()
    if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
  }

  // Real ingest, same route the wizard's step 1 uses - fills the same
  // fields manual mode edits directly, so switching modes mid-test just
  // shows what got scraped, editable rather than a separate data path.
  async function runIngest(e) {
    e.preventDefault()
    const normalized = normalizeUrl(url)
    if (!normalized) return
    setIngestBusy(true); setScriptError(null)
    try {
      const res = await fetch('/api/adbuilder/ingest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'url', url: normalized }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not analyze that')
      setBusinessName(data.brief.businessName || '')
      setWhatTheyDo(data.brief.whatTheyDo || '')
      setTone(data.brief.tone || '')
      setTrustSignals((data.brief.trustSignals || []).join(', '))
      setVertical(data.brief.vertical || 'general')
    } catch (err) {
      setScriptError(err.message)
    } finally {
      setIngestBusy(false)
    }
  }

  async function runScript() {
    if (!businessName.trim() || !whatTheyDo.trim()) { setScriptError('Business name and what they do are required'); return }
    setScriptBusy(true); setScriptError(null); setScript(null)
    try {
      const brief = {
        businessName: businessName.trim(),
        whatTheyDo: whatTheyDo.trim(),
        tone: tone.trim() || 'casual',
        trustSignals: trustSignals.split(',').map((s) => s.trim()).filter(Boolean),
        vertical,
      }
      const res = await fetch('/api/adbuilder/script', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          pipeline === 'fast' ? { brief, tone: pipelineTone, writer } : { brief, styleTag }
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not write a script')
      // The route also runs the full shot-breakdown Council pass (real API
      // cost) to produce scenes+atmosphere - riding them along on the
      // script object so they're actually visible instead of paid for and
      // silently discarded.
      setScript({ ...data.script, scenes: data.scenes, atmosphere: data.atmosphere })
    } catch (err) {
      setScriptError(err.message)
    } finally {
      setScriptBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 24px 100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 28 }}>Playground</h1>
            <InfoBubble text="Test script writing, ref images, and music generation directly - no need to run the full funnel." />
          </div>

          <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden' }}>
            {[['scripts', 'Scripts'], ['shots', 'Shots'], ['images', 'Images'], ['music', 'Music']].map(([key, label]) => (
              <button
                key={key} type="button" onClick={() => setTab(key)}
                style={{
                  padding: '8px 16px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
                  background: tab === key ? 'rgba(124,58,237,0.22)' : 'transparent', color: 'var(--fg)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'scripts' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, alignItems: 'start' }}>
            {/* Left: script inputs only, stays put while the right column scrolls */}
            <div style={{ position: 'sticky', top: 24 }}>
              <ScriptInputs
                mode={mode} setMode={setMode} url={url} setUrl={setUrl} ingestBusy={ingestBusy} runIngest={runIngest}
                businessName={businessName} setBusinessName={setBusinessName}
                whatTheyDo={whatTheyDo} setWhatTheyDo={setWhatTheyDo}
                tone={tone} setTone={setTone}
                trustSignals={trustSignals} setTrustSignals={setTrustSignals}
                vertical={vertical} setVertical={setVertical}
                styleTag={styleTag} setStyleTag={setStyleTag}
                pipeline={pipeline} setPipeline={setPipeline}
                pipelineTone={pipelineTone} setPipelineTone={setPipelineTone}
                writer={writer} setWriter={setWriter}
                busy={scriptBusy} error={scriptError} run={runScript}
                favorites={favorites} loadFavorite={loadFavorite} removeFavorite={removeFavorite}
              />
            </div>

            {/* Right: script results */}
            <div>
              <ScriptResults script={script} onFavorite={saveFavorite} isFavorited={favorites.some((f) => f.script?.narration === script?.narration)} />
            </div>
          </div>
        )}

        {tab === 'shots' && <ShotsPlayground brief={{ businessName, whatTheyDo, tone, trustSignals, vertical }} script={script} />}
        {tab === 'images' && <ImagePlayground />}
        {tab === 'music' && <MusicPlayground />}
      </div>
    </div>
  )
}

const TONE_PRESET_LABELS = { professional: 'Professional', funny: 'Funny', cinematic: 'Cinematic', zen: 'Zen' }

const VERTICAL_LABELS = { 'high-trust': 'High-Trust (medical/legal/financial)', food: 'Food & Beverage', tech: 'Software/B2B', 'home-services': 'Home Services', general: 'General' }

function ScriptInputs({
  mode, setMode, url, setUrl, ingestBusy, runIngest,
  businessName, setBusinessName, whatTheyDo, setWhatTheyDo, tone, setTone, trustSignals, setTrustSignals,
  vertical, setVertical,
  styleTag, setStyleTag, pipeline, setPipeline, pipelineTone, setPipelineTone, writer, setWriter,
  busy, error, run,
  favorites, loadFavorite, removeFavorite,
}) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Script</h2>
      {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden', width: 'fit-content', marginBottom: 14 }}>
        <button
          type="button" onClick={() => setMode('url')}
          style={{ padding: '7px 14px', fontSize: 12.5, border: 'none', cursor: 'pointer', background: mode === 'url' ? 'rgba(124,58,237,0.22)' : 'transparent', color: 'var(--fg)' }}
        >
          Website
        </button>
        <button
          type="button" onClick={() => setMode('manual')}
          style={{ padding: '7px 14px', fontSize: 12.5, border: 'none', cursor: 'pointer', background: mode === 'manual' ? 'rgba(124,58,237,0.22)' : 'transparent', color: 'var(--fg)' }}
        >
          Manual
        </button>
      </div>

      {mode === 'url' && (
        <form onSubmit={runIngest} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <input type="text" placeholder="yourbusiness.com" value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1 }} />
          <button
            type="submit" className="btn-gradient" disabled={ingestBusy}
            style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0, padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5,
            }}
          >
            {ingestBusy ? '…' : 'Go'}
          </button>
        </form>
      )}

      {(mode === 'manual' || businessName) && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            <LabeledField label="Business name">
              <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </LabeledField>
            <LabeledField label="What they do">
              <input type="text" value={whatTheyDo} onChange={(e) => setWhatTheyDo(e.target.value)} />
            </LabeledField>
            <LabeledField label="Tone">
              <input type="text" placeholder="e.g. playful/casual" value={tone} onChange={(e) => setTone(e.target.value)} />
            </LabeledField>
            <LabeledField label="Trust signals">
              <textarea
                rows={2} placeholder="Comma separated"
                value={trustSignals} onChange={(e) => setTrustSignals(e.target.value)}
                style={{ width: '100%', resize: 'vertical', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'var(--fg)', padding: '10px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif' }}
              />
            </LabeledField>
            <LabeledField label="Vertical (auto-detected from Website mode - drives framing/tone-register defaults)">
              <select
                value={vertical} onChange={(e) => setVertical(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'var(--fg)', padding: '10px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif' }}
              >
                {Object.entries(VERTICAL_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </LabeledField>
          </div>

          <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden', width: 'fit-content', marginBottom: 14 }}>
            <button
              type="button" onClick={() => setPipeline('council')}
              style={{ padding: '7px 14px', fontSize: 12.5, border: 'none', cursor: 'pointer', background: pipeline === 'council' ? 'rgba(124,58,237,0.22)' : 'transparent', color: 'var(--fg)' }}
            >
              Council (6-call)
            </button>
            <button
              type="button" onClick={() => setPipeline('fast')}
              style={{ padding: '7px 14px', fontSize: 12.5, border: 'none', cursor: 'pointer', background: pipeline === 'fast' ? 'rgba(124,58,237,0.22)' : 'transparent', color: 'var(--fg)' }}
            >
              Fast (2-call)
            </button>
          </div>

          {pipeline === 'council' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {STYLE_TAGS.map((t) => (
                <button
                  key={t.key} type="button" disabled={busy}
                  onClick={() => setStyleTag((cur) => (cur === t.key ? null : t.key))}
                  style={{
                    padding: '7px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 500,
                    border: `1px solid ${styleTag === t.key ? 'var(--accent-solid)' : 'rgba(255,255,255,0.12)'}`,
                    background: styleTag === t.key ? 'rgba(124,58,237,0.18)' : 'transparent',
                    color: 'var(--fg)', cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {pipeline === 'fast' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <LabeledField label="Tone">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(TONE_PRESET_LABELS).map(([key, label]) => (
                    <button
                      key={key} type="button" disabled={busy}
                      onClick={() => setPipelineTone(key)}
                      style={{
                        padding: '7px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 500,
                        border: `1px solid ${pipelineTone === key ? 'var(--accent-solid)' : 'rgba(255,255,255,0.12)'}`,
                        background: pipelineTone === key ? 'rgba(124,58,237,0.18)' : 'transparent',
                        color: 'var(--fg)', cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </LabeledField>
              <LabeledField label="Writer (pitches the story)">
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['gemini', 'Gemini'], ['grok', 'Grok']].map(([key, label]) => (
                    <button
                      key={key} type="button" disabled={busy}
                      onClick={() => setWriter(key)}
                      style={{
                        padding: '7px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 500,
                        border: `1px solid ${writer === key ? 'var(--accent-solid)' : 'rgba(255,255,255,0.12)'}`,
                        background: writer === key ? 'rgba(124,58,237,0.18)' : 'transparent',
                        color: 'var(--fg)', cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </LabeledField>
            </div>
          )}

          <button onClick={run} disabled={busy} className="btn-gradient" style={{ width: '100%', height: 44, opacity: busy ? 0.6 : 1 }}>
            {busy
              ? (pipeline === 'fast' ? 'Writing… (~10-15s)' : 'Writing… (~30-45s, real multi-model pass)')
              : 'Generate Script'}
          </button>
        </>
      )}

      {favorites?.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 10 }}>
            Favorites ({favorites.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
            {favorites.map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button" onClick={() => loadFavorite(f)}
                  className="btn-ghost" style={{ flex: 1, textAlign: 'left', fontSize: 12.5, padding: '7px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {f.businessName || 'Untitled'}{f.styleTag ? ` · ${f.styleTag}` : ''}
                </button>
                <button
                  type="button" onClick={() => removeFavorite(f.id)} aria-label="Remove favorite"
                  style={{ background: 'none', border: 'none', color: 'var(--mist)', cursor: 'pointer', fontSize: 14, padding: '4px 6px' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ScriptResults({ script, onFavorite, isFavorited }) {
  if (!script) {
    return (
      <div className="card" style={{ padding: 24, color: 'var(--mist)', fontSize: 14 }}>
        Script results will show up here once you generate one on the left.
      </div>
    )
  }
  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18 }}>Script results</h2>
        <button
          type="button" onClick={onFavorite} disabled={isFavorited}
          className="btn-ghost" style={{ fontSize: 12.5, opacity: isFavorited ? 0.6 : 1 }}
        >
          {isFavorited ? '★ Favorited' : '☆ Favorite'}
        </button>
      </div>
      <div className="card" style={{ padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 5 }}>Narration</div>
        <div style={{ fontSize: 14.5 }}>"{script.narration}"</div>
      </div>
      <div className="card" style={{ padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 5 }}>Visual</div>
        <div style={{ fontSize: 14.5 }}>{script.visual}</div>
      </div>

      {script.atmosphere && (
        <div className="card" style={{ padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 5 }}>Atmosphere (locked across shots)</div>
          <div style={{ fontSize: 14.5 }}>{script.atmosphere}</div>
        </div>
      )}

      {script.scenes?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 8 }}>
            Shot breakdown ({script.scenes.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {script.scenes.map((s, i) => (
              <div key={i} className="card" style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 3 }}>Shot {i + 1} · {s.durationSeconds}s</div>
                <div style={{ fontSize: 13.5, color: 'var(--mist)' }}>{s.sceneDescription}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ScriptTrace trace={script.trace} />
    </div>
  )
}

const CLIP_DURATIONS = [
  { value: 6, label: '6s' },
  { value: 10, label: '10s' },
  { value: 30, label: '30s (Seedance)' },
]
const FRAMINGS = [
  { value: 'people', label: 'People' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'objects', label: 'Objects' },
]

// Real, text-only test of the shot breakdown's new configurable
// dimensions (max scenes / clip duration+engine tier / people-vs-objects
// framing bias) - deliberately stops at the breakdown text, not real
// image/video generation, so trying different combinations is cheap. The
// real funnel is where you'd confirm an actual keyframe/render once the
// breakdown itself reads right.
function ShotsPlayground({ brief, script }) {
  const [maxScenes, setMaxScenes] = useState(4)
  const [clipDuration, setClipDuration] = useState(6)
  const [framing, setFraming] = useState('balanced')
  const [continuity, setContinuity] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function run() {
    if (!script) { setError('Generate a script on the Scripts tab first'); return }
    setBusy(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/adbuilder/playground/breakdown', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, script, options: { maxScenes, clipDuration, framing, continuity } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not generate breakdown')
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Shot breakdown</h2>
      {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {!script && <div style={{ color: 'var(--mist)', fontSize: 13.5, marginBottom: 16 }}>Uses whatever script you last generated on the Scripts tab.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
        <LabeledField label={`Max scenes: ${maxScenes}`}>
          <input type="range" min={1} max={6} value={maxScenes} onChange={(e) => setMaxScenes(Number(e.target.value))} style={{ width: '100%' }} />
        </LabeledField>

        <LabeledField label="Clip length / engine">
          <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
            {CLIP_DURATIONS.map((d) => (
              <button
                key={d.value} type="button" onClick={() => setClipDuration(d.value)}
                style={{ padding: '7px 14px', fontSize: 12.5, border: 'none', cursor: 'pointer', background: clipDuration === d.value ? 'rgba(124,58,237,0.22)' : 'transparent', color: 'var(--fg)' }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </LabeledField>

        <LabeledField label="Framing bias">
          <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
            {FRAMINGS.map((f) => (
              <button
                key={f.value} type="button" onClick={() => setFraming(f.value)}
                style={{ padding: '7px 14px', fontSize: 12.5, border: 'none', cursor: 'pointer', background: framing === f.value ? 'rgba(124,58,237,0.22)' : 'transparent', color: 'var(--fg)' }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </LabeledField>

        <LabeledField label="Shot generation">
          <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
            <button
              type="button" onClick={() => setContinuity(false)}
              style={{ padding: '7px 14px', fontSize: 12.5, border: 'none', cursor: 'pointer', background: !continuity ? 'rgba(124,58,237,0.22)' : 'transparent', color: 'var(--fg)' }}
            >
              Parallel (fast)
            </button>
            <button
              type="button" onClick={() => setContinuity(true)}
              style={{ padding: '7px 14px', fontSize: 12.5, border: 'none', cursor: 'pointer', background: continuity ? 'rgba(124,58,237,0.22)' : 'transparent', color: 'var(--fg)' }}
            >
              Continuity (chained, slower)
            </button>
          </div>
        </LabeledField>
      </div>

      <button onClick={run} disabled={busy} className="btn-gradient" style={{ width: '100%', height: 44, marginBottom: result ? 16 : 0, opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Breaking down…' : 'Generate Breakdown'}
      </button>

      {result && (
        <div>
          <div className="card" style={{ padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 5 }}>Atmosphere</div>
            <div style={{ fontSize: 14.5 }}>{result.atmosphere}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.shots.map((s, i) => (
              <div key={i} className="card" style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 3 }}>Shot {i + 1} · {s.durationSeconds}s</div>
                <div style={{ fontSize: 13.5, color: 'var(--mist)' }}>{s.sceneDescription}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ImagePlayground() {
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [imageDataUrl, setImageDataUrl] = useState(null)

  async function run() {
    if (!prompt.trim()) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/adbuilder/playground/image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not generate image')
      setImageDataUrl(data.imageDataUrl)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Ref image (Flux)</h2>
      {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <textarea
        rows={2} placeholder="A visual/scene description, same shape as a shot's sceneDescription"
        value={prompt} onChange={(e) => setPrompt(e.target.value)}
        style={{ width: '100%', marginBottom: 12, resize: 'vertical', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'var(--fg)', padding: '10px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif' }}
      />
      <button onClick={run} disabled={busy} className="btn-gradient" style={{ width: '100%', height: 44, marginBottom: imageDataUrl ? 16 : 0, opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Generating…' : 'Generate Image'}
      </button>
      {imageDataUrl && <img src={imageDataUrl} alt="Generated" style={{ width: '100%', borderRadius: 10, display: 'block' }} />}
    </div>
  )
}

function MusicPlayground() {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [option, setOption] = useState(null)

  async function search(e) {
    e.preventDefault()
    if (!term.trim()) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/adbuilder/playground/music?term=${encodeURIComponent(term.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setResults(data.results)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function generate(ref) {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/adbuilder/playground/music', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previewUrl: ref?.previewUrl, genre: ref?.genre }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not generate music')
      setOption(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Music</h2>
      {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <form onSubmit={search} style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input type="text" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. upbeat acoustic, smooth jazz" style={{ flex: 1 }} />
        <button type="submit" className="btn-gradient" disabled={busy} style={{ padding: '0 20px' }}>Search</button>
      </form>

      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {results.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
              <audio src={r.previewUrl} controls style={{ height: 32, flex: 1 }} />
              <span style={{ color: 'var(--mist)', minWidth: 140 }}>{r.artist} — {r.track}</span>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => generate(r)} style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>Generate from this</button>
            </div>
          ))}
        </div>
      )}

      {option && (
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 8 }}>Generated</div>
          <audio src={option.audioDataUrl} controls style={{ width: '100%', marginBottom: 8 }} />
          <div style={{ fontSize: 12.5, color: 'var(--mist)' }}>{option.prompt}</div>
        </div>
      )}
    </div>
  )
}

function LabeledField({ label, children }) {
  return (
    <div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

// Same info-bubble pattern as ShotReview's Fix Image/Fix Motion toggle -
// a small "i" that reveals an explanation on click instead of permanent
// body text taking up space next to the heading.
function InfoBubble({ text }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button" onClick={() => setOpen((v) => !v)} aria-label="What is this?"
        style={{
          width: 18, height: 18, borderRadius: '50%', border: '1px solid var(--mist)', background: 'none',
          color: 'var(--mist)', fontSize: 11, lineHeight: 1, cursor: 'pointer', padding: 0,
        }}
      >
        i
      </button>
      {open && (
        <div className="card" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 260, zIndex: 5, padding: 12, fontSize: 12.5, lineHeight: 1.5 }}>
          {text}
        </div>
      )}
    </div>
  )
}
