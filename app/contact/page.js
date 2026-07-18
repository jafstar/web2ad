import SiteHeader from '../../components/SiteHeader'

export default function ContactPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 24px 96px' }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>contact</div>
        <h1 style={{ fontSize: 'clamp(32px, 3.6vw, 46px)', lineHeight: 1.05, letterSpacing: '-0.01em', marginBottom: 16 }}>
          Talk to a person, not a bot.
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--mist)', marginBottom: 32 }}>
          Questions about pricing, BYOK desktop, or something that broke — email us directly and we'll get back to you.
        </p>

        <a href="mailto:hello@aint.farm?subject=Genstock" className="btn-primary" style={{ padding: '14px 28px', fontSize: 15, display: 'inline-block', textDecoration: 'none' }}>
          hello@aint.farm
        </a>
      </div>
    </div>
  )
}
