'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SiteHeader from '../components/SiteHeader'

// Real friction point (same fix as the /adbuilder wizard's own input):
// typing "yourbusiness.com" without a scheme is the natural thing to do.
function normalizeUrl(value) {
  const trimmed = value.trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

// Rebuilt on top of the genstock fork's real design system (dark neutral
// bg, Fraunces/Inter/JetBrains Mono, gradient accent, .card panel style —
// see globals.css). Real change, 2026-07-25: the old two-column hero
// (pitch text + VideoHero) is gone in favor of the actual product action
// itself - paste a url, land straight on /adbuilder with ingest already
// running (see AdBuilderWizard's ?url= handoff), skipping a second retype
// of the same url on the wizard's own step 1.
export default function LandingPage() {
  const [url, setUrl] = useState('')
  const router = useRouter()

  function handleSubmit(e) {
    e.preventDefault()
    const normalized = normalizeUrl(url)
    if (!normalized) return
    router.push(`/adbuilder?url=${encodeURIComponent(normalized)}`)
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />

      <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto', padding: '72px 32px 56px' }}>
        <h1 style={{ fontSize: 'clamp(38px, 4.4vw, 60px)', lineHeight: 1.04, letterSpacing: '-0.01em', marginBottom: 20 }}>
          Turn any URL into a <em className="gradient-text" style={{ fontStyle: 'italic' }}>Commercial</em>
        </h1>
        <p style={{ fontSize: 16.5, lineHeight: 1.6, color: 'var(--mist)', maxWidth: 480, margin: '0 auto 36px' }}>
          It writes the story, casts the shots, generates the video, scores the music, and voices the read.
        </p>

        <form onSubmit={handleSubmit} style={{ maxWidth: 560, margin: '0 auto' }}>
          <input
            type="text" required placeholder="yourbusiness.com"
            value={url} onChange={(e) => setUrl(e.target.value)}
            onBlur={(e) => setUrl(normalizeUrl(e.target.value))}
            style={{ width: '100%', height: 64, fontSize: 20, padding: '0 20px', marginBottom: 16 }}
          />
          <button type="submit" className="btn-gradient" style={{ width: '100%', height: 56, fontSize: 16 }}>
            Start
          </button>
        </form>
      </div>
    </div>
  )
}
