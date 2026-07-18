import SiteHeader from '../../components/SiteHeader'

const FAQS = [
  {
    q: 'What engines does genstock actually use?',
    a: 'Flux, Recraft, and Gemini generate every round side by side. Each is genuinely different at different things, so comparing them beats picking one and hoping.',
  },
  {
    q: 'Do I need my own API keys?',
    a: "Not on the hosted plan — we hold the keys, you just generate against your credit balance. If you'd rather use your own keys with no per-round cost, the BYOK desktop version (via DesignPipe) is built for that.",
  },
  {
    q: 'What happens to images I don’t heart?',
    a: "Nothing — they just sit in that round's history. Only the ones you heart get pulled into Lightbox, and only exports actually cost anything on the hosted plan.",
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes — 3 free rounds to start, 3 images each, 9 previews total, no card required. Exports and downloads on those free rounds aren’t included.',
  },
  {
    q: 'Can I export full-resolution originals?',
    a: 'On the hosted plan, exports are metered against your credit balance. On BYOK desktop, exports are unlimited since there’s no per-action cost to us — it’s your own key.',
  },
  {
    q: 'What’s the difference between hosted and BYOK desktop?',
    a: 'Same underlying engine either way. Hosted is sign-in-and-go with credit packs; BYOK desktop is a flat $50/year with your own API keys and no usage caps.',
  },
]

export default function FaqPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 24px 96px' }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>faq</div>
        <h1 style={{ fontSize: 'clamp(32px, 3.6vw, 46px)', lineHeight: 1.05, letterSpacing: '-0.01em', marginBottom: 48 }}>
          Questions people actually ask.
        </h1>

        {FAQS.map((f) => (
          <div key={f.q} style={{ borderBottom: '1px solid rgba(255,255,255,0.09)', padding: '24px 0' }}>
            <h2 style={{ fontSize: 17, marginBottom: 8 }}>{f.q}</h2>
            <p style={{ color: 'var(--mist)', fontSize: 14.5, lineHeight: 1.6 }}>{f.a}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
