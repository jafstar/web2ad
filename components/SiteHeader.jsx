'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
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
//
// Real bug, live-caught: this had zero mobile handling at all - the
// three-column grid (logo + 4 nav links + login/signup) needs 700-900px
// minimum, guaranteed to overflow/wrap badly under ~430px. Now a real
// hamburger menu below 768px, same nav content in a dropdown.
export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="site-header">
      <div className="site-header-bar">
        <Link href="/" className="site-header-logo" onClick={() => setMenuOpen(false)}>
          <GenstockLogo size={64} />
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 20 }}>genstock</span>
        </Link>

        <nav className="site-header-nav-desktop">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="nav-link">{l.label}</Link>
          ))}
        </nav>

        <div className="site-header-actions-desktop">
          <Link href="/login" className="nav-link plain">Login</Link>
          <Link href="/login?intent=signup" className="btn-gradient" style={{ padding: '9px 20px', fontSize: 14 }}>Sign Up</Link>
        </div>

        <button
          type="button"
          className="site-header-hamburger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {menuOpen && (
        <nav className="site-header-nav-mobile">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="nav-link" onClick={() => setMenuOpen(false)}>{l.label}</Link>
          ))}
          <div className="site-header-actions-mobile">
            <Link href="/login" className="nav-link plain" onClick={() => setMenuOpen(false)}>Login</Link>
            <Link href="/login?intent=signup" className="btn-gradient" onClick={() => setMenuOpen(false)}>Sign Up</Link>
          </div>
        </nav>
      )}
    </header>
  )
}
