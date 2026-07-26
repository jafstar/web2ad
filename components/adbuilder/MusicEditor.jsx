'use client'

import { useState } from 'react'

// Real user-in-the-loop version of the free tier's auto-picked music:
// search real iTunes reference tracks, pick one, generate from its real
// analyzed BPM/energy, keep generating more options and pick whichever
// one actually fits once you can hear it against the real shots above.
export default function MusicEditor({ runId, schema, onChosen }) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [options, setOptions] = useState(schema.musicOptions || [])
  const [chosen, setChosen] = useState(schema.chosenMusic || null)

  async function runSearch(e) {
    e.preventDefault()
    if (!term.trim()) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/adbuilder/run/${runId}/music/search?term=${encodeURIComponent(term.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResults(data.results)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function generateFrom(ref) {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/adbuilder/run/${runId}/music/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previewUrl: ref?.previewUrl, genre: ref?.genre }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOptions((prev) => [...prev, data.option])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function choose(url) {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/adbuilder/run/${runId}/music/choose`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setChosen(url)
      onChosen?.(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Music</div>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Pick a real sound for this ad</h2>

      {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <form onSubmit={runSearch} style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          type="text" value={term} onChange={(e) => setTerm(e.target.value)}
          placeholder="e.g. upbeat acoustic, smooth jazz, energetic rock"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn-ghost" disabled={busy} style={{ whiteSpace: 'nowrap' }}>Search</button>
      </form>

      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {results.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
              <audio src={r.previewUrl} controls style={{ height: 32, flex: 1 }} />
              <span style={{ color: 'var(--mist)', minWidth: 160 }}>{r.artist} — {r.track}</span>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => generateFrom(r)} style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                Generate from this
              </button>
            </div>
          ))}
        </div>
      )}

      {options.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Generated options</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {options.map((o) => (
              <div key={o.url} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <audio src={o.url} controls style={{ height: 32, flex: 1 }} />
                <button
                  type="button" disabled={busy || chosen === o.url}
                  onClick={() => choose(o.url)}
                  className={chosen === o.url ? 'btn-gradient' : 'btn-ghost'}
                  style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}
                >
                  {chosen === o.url ? 'Selected ✓' : 'Use this'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
