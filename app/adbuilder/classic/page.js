import SiteHeader from '../../../components/SiteHeader'
import AdBuilderWizard from '../../../components/adbuilder/AdBuilderWizard'

// v1's original 4-step free wizard (url -> brief -> script -> preview),
// unhooked from the main ingestion entry point 2026-07-26 in favor of the
// new 3-step v2 flow at /adbuilder - kept here as-is (component itself
// untouched) for reference/fallback, not linked from the homepage.
export const metadata = {
  title: 'Build Your Ad (Classic) — Web2Ad',
  description: 'The original step-by-step ad builder: URL, brief, script, then a 5-second preview.',
}

export default function AdBuilderClassicPage() {
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
        <AdBuilderWizard />
      </div>
    </div>
  )
}
