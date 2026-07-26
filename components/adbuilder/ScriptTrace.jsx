'use client'

import { useState } from 'react'

// Real debugging need, live-caught: every Council step (draft, refine,
// all 4 critiques) previously only existed as a console.log that scrolled
// away the moment the request finished - no way to see WHY a script came
// out the way it did. Shared between the wizard's script step and the
// Playground so there's exactly one place this rendering lives.
export default function ScriptTrace({ trace }) {
  const [open, setOpen] = useState(false)
  if (!trace) return null

  if (trace.mode === 'fast') {
    return (
      <div style={{ marginBottom: 24 }}>
        <button
          type="button" onClick={() => setOpen((v) => !v)}
          className="btn-ghost" style={{ fontSize: 12.5, marginBottom: open ? 14 : 0 }}
        >
          {open ? 'Hide' : 'Show'} the writing process (fast: {trace.writer}, {trace.tone})
        </button>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <TraceStep label={`1. ${trace.writer === 'grok' ? 'Grok' : 'Gemini'} pitch (${trace.tone})`} text={trace.pitch} />
            <TraceStep label="2. Claude edit + scenery" text="(final narration/visual shown above)" muted />
          </div>
        )}
      </div>
    )
  }

  const notes = [
    ['Arbiter (Claude)', trace.notes?.arbiter],
    ['Realist (Gemini)', trace.notes?.realist],
    ['Visionary (ChatGPT)', trace.notes?.visionary],
    ['Jester (Grok)', trace.notes?.jester],
  ].filter(([, v]) => v)

  return (
    <div style={{ marginBottom: 24 }}>
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        className="btn-ghost" style={{ fontSize: 12.5, marginBottom: open ? 14 : 0 }}
      >
        {open ? 'Hide' : 'Show'} the writing process {trace.styleTag ? `(style: ${trace.styleTag})` : ''}
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TraceStep label="1. Claude draft" text={trace.claudeDraft} />
          <TraceStep label="2. Gemini refine" text={trace.refinedDraft} />
          {notes.map(([label, text]) => (
            <TraceStep key={label} label={label} text={text} muted />
          ))}
        </div>
      )}
    </div>
  )
}

function TraceStep({ label, text, muted }) {
  return (
    <div className="card" style={{ padding: '12px 14px', background: muted ? 'rgba(255,255,255,0.02)' : 'rgba(124,58,237,0.06)' }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  )
}
