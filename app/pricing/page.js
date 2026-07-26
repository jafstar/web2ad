import Link from 'next/link'
import SiteHeader from '../../components/SiteHeader'

// Real pricing isn't decided yet - deliberately not committing to numbers
// or tiers here rather than leaving the old genstock BYOK-desktop pricing
// up (which had nothing to do with this product).
export default function PricingPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />

      <div style={{ padding: '96px 24px', textAlign: 'center' }}>
        <div className="eyebrow" style={{ marginBottom: 14, justifyContent: 'center' }}>pricing</div>
        <h1 style={{ fontSize: 'clamp(32px, 3.6vw, 46px)', lineHeight: 1.05, letterSpacing: '-0.01em', marginBottom: 16 }}>
          Coming soon.
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--mist)', maxWidth: 480, margin: '0 auto 40px' }}>
          We're still finalizing pricing. In the meantime, the free 5-second preview costs nothing and takes no card or signup.
        </p>
        <Link href="/adbuilder" className="btn-primary" style={{ display: 'inline-block' }}>Try the free preview</Link>
      </div>
    </div>
  )
}
