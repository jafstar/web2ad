import Link from 'next/link'
import SiteHeader from '../../components/SiteHeader'

const FEATURES = [
  {
    title: 'Bring a photo, not a prompt',
    body: "Drop in a reference photo and genstock reads the real location, objects, and light in it — turning that into a ready-to-use description instead of a blank box.",
    img: '/marketing/screenshot-intake-2.png',
    alt: 'Intake screen: a reference photo analyzed automatically into a ready-to-use description',
  },
  {
    title: 'Three engines, every round',
    body: 'Each round runs Flux, Recraft, and Gemini side by side on the same brief — no single model guessing alone, no picking an engine up front and hoping.',
    img: '/marketing/screenshot-critique-2.png',
    alt: 'Critique screen showing the same round generated across Flux, Recraft, and Gemini',
  },
  {
    title: 'Heart the winner, skip the rest',
    body: "Compare a whole round at a glance, heart the one that's actually right, and it's saved straight to your Lightbox. The ones you don't keep cost you nothing to ignore.",
    img: '/marketing/screenshot-lightbox.png',
    alt: 'Lightbox screen showing hearted images saved from Critique',
  },
]

export default function FeaturesPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />

      <div style={{ padding: '24px 72px 8px' }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>features</div>
        <h1 style={{ fontSize: 'clamp(32px, 3.6vw, 46px)', lineHeight: 1.05, letterSpacing: '-0.01em', marginBottom: 16, maxWidth: 640 }}>
          Images galore, chosen — not guessed.
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--mist)', maxWidth: 560, marginBottom: 48 }}>
          No mockups here — every screen below is the real, shipped product.
        </p>
      </div>

      <div style={{ padding: '0 72px 96px', display: 'flex', flexDirection: 'column', gap: 72 }}>
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 48,
              alignItems: 'center',
              direction: i % 2 === 1 ? 'rtl' : 'ltr',
            }}
          >
            <div className="card" style={{ padding: 10, direction: 'ltr' }}>
              <img src={f.img} alt={f.alt} style={{ width: '100%', display: 'block', borderRadius: 8 }} />
            </div>
            <div style={{ direction: 'ltr' }}>
              <h2 style={{ fontSize: 24, marginBottom: 12 }}>{f.title}</h2>
              <p style={{ color: 'var(--mist)', fontSize: 15.5, lineHeight: 1.6, maxWidth: 440 }}>{f.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 72px 96px', textAlign: 'center' }}>
        <Link href="/login?intent=signup" className="btn-primary" style={{ padding: '14px 32px', fontSize: 15 }}>Start generating</Link>
      </div>

      <style>{`
        @media (max-width: 900px) {
          div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; direction: ltr !important; }
        }
      `}</style>
    </div>
  )
}
