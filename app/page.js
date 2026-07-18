import Link from 'next/link'
import SiteHeader from '../components/SiteHeader'
import HeroStack from './HeroStack'

// Real saved-up marketing (mailbox/artifacts/gen-stock/genstock-hero.html
// + genstock-launch-plan.md, sync-agent repo) — copy and ink/amber visual
// direction kept as originally written, not the black/white hairline-rule
// redesign a design-review pass had pushed toward. Proof section uses
// real screenshots of the shipped app (Intake + Critique) instead of an
// abstract animated demo console.
export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />

      <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '0.7fr 1.3fr', alignItems: 'center', gap: 40, padding: '56px 56px' }}>
        <div style={{ maxWidth: 520 }}>
          <div className="eyebrow" style={{ marginBottom: 22 }}>Zero Searching, Zero Prompts</div>
          <h1 style={{ fontSize: 'clamp(38px, 4.4vw, 62px)', lineHeight: 1.04, letterSpacing: '-0.01em', marginBottom: 24 }}>
            If images had <em className="gradient-text" style={{ fontStyle: 'italic' }}>keyboards</em><br />— this is it.
          </h1>
          <p style={{ fontSize: 16.5, lineHeight: 1.6, color: 'var(--mist)', maxWidth: 440, marginBottom: 36 }}>
            Generate across multiple sources at once, watch the council pick the strongest options, and curate down to the one worth keeping. No blank prompt box. No single model guessing alone.
          </p>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 28 }}>
            <Link href="/app" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', height: 48, padding: '0 28px' }}>Start generating</Link>
            <Link href="/features" className="btn-ghost">See how it works →</Link>
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--mist)', textTransform: 'uppercase' }}>
            3 free rounds to start · no card required
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <HeroStack />
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
