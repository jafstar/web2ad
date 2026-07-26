import SiteHeader from '../../components/SiteHeader'
import ProofGrid from '../ProofGrid'

export const metadata = {
  title: 'Examples — Web2Ad',
  description: 'Real Genmercials made with Web2Ad — no camera, no studio, no actors.',
}

// The 4 real ads that used to sit under the homepage's hero, moved here
// 2026-07-25 so the homepage is just the input, nothing else.
export default function ExamplesPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '56px 24px 24px', textAlign: 'center' }}>
        <div className="eyebrow" style={{ justifyContent: 'center', marginBottom: 14 }}>Real Output</div>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginBottom: 12 }}>Examples</h1>
        <p style={{ color: 'var(--mist)', fontSize: 15.5 }}>Real Genmercials made with Web2Ad — no camera, no studio, no actors.</p>
      </div>
      <ProofGrid />
    </div>
  )
}
