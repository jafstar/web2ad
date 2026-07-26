import SiteHeader from '../../components/SiteHeader'

// Real web2ad FAQs, replacing leftover genstock-fork content (Flux/Recraft
// image rounds, hearting, BYOK desktop - none of it applied to this
// product). Pulled from the actual built funnel: URL -> brief -> Council
// script -> free 5s preview (no signup) -> paid multi-shot generation ->
// shot review/regenerate -> music pick -> export.
const FAQS = [
  {
    q: 'How does this actually work?',
    a: 'Paste your website (or type a quick description of your business). We pull your real brand facts, write a short script with an actual story and character, and generate a video ad from it - no camera, no actors, no editing software.',
  },
  {
    q: 'Do I need a script or shots ready first?',
    a: "No - paste your URL and Web2Ad drafts the whole thing: script, shot breakdown, and music. You review and can regenerate anything you don't like before it's final.",
  },
  {
    q: 'Is the free preview really free?',
    a: 'Yes. No signup and no card required for the 5-second preview - one real scene with narration and music, generated from your actual site. You only sign up when you want the full ad.',
  },
  {
    q: 'How long is the finished ad?',
    a: 'Typically 15-30 seconds, depending on how many shots you keep and which clip-length tier you choose.',
  },
  {
    q: "Can I pick the music, or fix a shot I don't like?",
    a: "Both. Search real reference tracks or generate original instrumental options and choose before export. Any individual shot's image or motion can be regenerated with a quick note on what to change, without restarting the whole ad.",
  },
  {
    q: 'What does it cost?',
    a: "We're still finalizing pricing - see the Pricing page for the latest. The free preview costs nothing regardless.",
  },
  {
    q: 'Who is this for?',
    a: 'Small and local businesses - restaurants, salons, HVAC, dental, anyone who wants a real commercial without hiring a production crew.',
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
