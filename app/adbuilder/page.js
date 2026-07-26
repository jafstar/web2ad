import SiteHeader from '../../components/SiteHeader'
import AdBuilderWizard from '../../components/adbuilder/AdBuilderWizard'

export const metadata = {
  title: 'Build Your Ad — Web2Ad',
  description: 'Feed us your website (or just describe your business) and get a real 5-second ad preview in under a minute — free, no signup required.',
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
        <AdBuilderWizard />
      </div>
    </div>
  )
}
