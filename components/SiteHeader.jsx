import Link from 'next/link'
import GenstockLogo from './GenstockLogo'

const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
]

// Shared marketing-site header — landing page + Features/Pricing/FAQ/
// Contact all mount this so nav stays identical everywhere. Three-column
// grid (not flex space-between) so the center nav is genuinely centered
// regardless of how wide the logo/wordmark or the login+signup pair are.
export default function SiteHeader() {
  return (
    <header style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 24, padding: '28px 72px' }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: 'inherit', justifySelf: 'start' }}>
        <GenstockLogo size={64} />
        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 20 }}>genstock</span>
      </Link>

      <nav style={{ display: 'flex', gap: 32, justifySelf: 'center' }}>
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="nav-link">{l.label}</Link>
        ))}
      </nav>

      <div style={{ display: 'flex', gap: 20, alignItems: 'center', justifySelf: 'end' }}>
        <Link href="/login" className="nav-link plain">Login</Link>
        <Link href="/login?intent=signup" className="btn-gradient" style={{ padding: '9px 20px', fontSize: 14 }}>Sign Up</Link>
      </div>
    </header>
  )
}
