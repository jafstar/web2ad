'use client'

import { useEffect, useState } from 'react'

// Two real screenshots (Intake + Critique) stacked, swapping which one
// sits on top on a slow timer — just the images and the motion between
// them, plus a static two-step description below that highlights
// whichever step the front image currently represents.
const SCREENS = [
  { key: 'intake', src: '/marketing/screenshot-intake-tags.png', alt: 'genstock Intake screen — a reference photo broken into selectable Focus/Detail word tags instead of a prompt box' },
  { key: 'critique', src: '/marketing/screenshot-critique.png', alt: 'genstock Critique screen — the same round generated across Flux, Recraft, and Gemini' },
]

const STEPS = [
  { n: '01', title: 'Load the image', body: 'Drop in a reference photo — genstock reads the real location, objects, and light in it.' },
  { n: '02', title: 'Curate the variations', body: 'Every round runs multiple engines side by side. Heart the one that’s actually right.' },
]

const ROTATE_MS = 8000

export default function HeroStack() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a === 0 ? 1 : 0)), ROTATE_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ width: '100%', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ position: 'relative', width: '100%', paddingTop: `${(781 / 988) * 100}%` }}>
        {SCREENS.map((s, i) => (
          <div
            key={s.key}
            className={'card stack-card' + (i === active ? ' front' : ' back')}
            style={{ position: 'absolute', inset: 0, padding: 10, overflow: 'hidden' }}
          >
            <img src={s.src} alt={s.alt} style={{ width: '100%', height: '100%', display: 'block', borderRadius: 8, objectFit: 'contain' }} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 40, marginTop: 32 }}>
        {STEPS.map((s, i) => (
          <div key={s.n} style={{ flex: 1, opacity: i === active ? 1 : 0.4, transition: 'opacity .5s ease' }}>
            <div className={i === active ? 'gradient-text' : undefined} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.06em', color: i === active ? undefined : 'var(--mist)', marginBottom: 6, fontWeight: 600 }}>{s.n}</div>
            <h3 style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 6 }}>{s.title}</h3>
            <p style={{ color: 'var(--mist)', fontSize: 13.5, lineHeight: 1.55 }}>{s.body}</p>
          </div>
        ))}
      </div>

      <style>{`
        .stack-card {
          transition: transform 1.8s cubic-bezier(.4,0,.2,1), box-shadow 1.8s ease, filter 1.8s ease;
        }
        .stack-card.back {
          transform: translate(24px, 24px);
          z-index: 1;
          filter: brightness(0.75);
          box-shadow: none;
        }
        .stack-card.front {
          transform: translate(0, 0);
          z-index: 2;
          filter: brightness(1);
          box-shadow: 0 24px 60px -12px rgba(0,0,0,0.55);
        }
        @media (max-width: 900px) {
          div[style*="display: flex"][style*="gap: 40"] { flex-direction: column; gap: 20px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .stack-card { transition: none !important; }
        }
      `}</style>
    </div>
  )
}
