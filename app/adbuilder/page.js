import SiteHeader from '../../components/SiteHeader'
import BeatAdWizard from '../../components/adbuilder/BeatAdWizard'

// Real 3-step v2 funnel, live 2026-07-26: url -> first-scene preview
// (audio + narrator + visual) -> generate + download. v1's original
// 4-step wizard moved to /adbuilder/classic - see that page for the prior
// url/brief/script/preview flow, kept as-is, just no longer the entry
// point the homepage's URL box hands off into.
export const metadata = {
  title: 'Build Your Ad — Web2Ad',
  description: 'Feed us your website (or just describe your business) and see your first scene — narration, voice, and visual — in under a minute. Free, no signup required.',
}

export default function AdBuilderPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <div style={{ padding: '56px 32px 100px' }}>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 40px' }}>
          <div className="eyebrow" style={{ justifyContent: 'center', marginBottom: 18 }}>Free Preview · No Signup Required</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', lineHeight: 1.1 }}>
            Make a <em className="gradient-text" style={{ fontStyle: 'italic' }}>commercial</em> in 10 min.
          </h1>
        </div>
        <BeatAdWizard />
      </div>
    </div>
  )
}
