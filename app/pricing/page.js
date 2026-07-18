import Link from 'next/link'
import SiteHeader from '../../components/SiteHeader'

export default function PricingPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />

      <div style={{ padding: '24px 72px 8px', textAlign: 'center' }}>
        <div className="eyebrow" style={{ marginBottom: 14, justifyContent: 'center' }}>pricing</div>
        <h1 style={{ fontSize: 'clamp(32px, 3.6vw, 46px)', lineHeight: 1.05, letterSpacing: '-0.01em', marginBottom: 16 }}>
          Two ways to run genstock.
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--mist)', maxWidth: 560, margin: '0 auto 56px' }}>
          Same engine either way — hosted with credits, or bring your own keys on desktop.
        </p>
      </div>

      <div style={{ padding: '0 72px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, maxWidth: 900, margin: '0 auto' }}>
        <div className="card" style={{ padding: 32 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.1em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 10 }}>Hosted</div>
          <h2 style={{ fontSize: 26, marginBottom: 18 }}>Sign in, generate, pay as you go</h2>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28, color: 'var(--fg)', fontSize: 14.5, lineHeight: 1.5 }}>
            <li>3 free rounds to start — 9 previews, no card required</li>
            <li>No free exports or downloads on the free rounds</li>
            <li>$10 credit pack — roughly 30–40 rounds</li>
            <li>$20 credit pack — better rate per round</li>
            <li>We hold the API keys, you just generate</li>
          </ul>
          <Link href="/login?intent=signup" className="btn-primary" style={{ display: 'block', textAlign: 'center' }}>Start free</Link>
        </div>

        <div className="card" style={{ padding: 32 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.1em', color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 10 }}>BYOK Desktop</div>
          <h2 style={{ fontSize: 26, marginBottom: 18 }}>$50<span style={{ fontSize: 15, color: 'var(--mist)', fontWeight: 400 }}>/year</span></h2>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28, color: 'var(--fg)', fontSize: 14.5, lineHeight: 1.5 }}>
            <li>Flat annual price, no per-round cost from us</li>
            <li>Bring your own Flux / Recraft / Gemini API keys</li>
            <li>Same engine, packaged natively for desktop (via DesignPipe)</li>
            <li>No usage caps — your key, your rate</li>
          </ul>
          <a href="mailto:hello@aint.farm?subject=Genstock%20BYOK%20desktop" className="btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>Get in touch</a>
        </div>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--mist)', fontSize: 13.5, padding: '24px 72px 96px' }}>
        Have questions about either plan? Check the <Link href="/faq" className="nav-link" style={{ display: 'inline' }}>FAQ</Link> or <Link href="/contact" className="nav-link" style={{ display: 'inline' }}>contact us</Link>.
      </p>

      <style>{`
        @media (max-width: 900px) {
          div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
