'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import GenstockLogo from './GenstockLogo'
import AccountMenu from './AccountMenu'
import { createClient } from '../lib/supabase/client'

const NAV_LINKS = [
  { href: '/examples', label: 'Examples' },
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
  const [user, setUser] = useState(null)
  const [checkedAuth, setCheckedAuth] = useState(false)
  const router = useRouter()

  // Real auth-awareness - this header previously always showed Login/Sign
  // Up regardless of session state, so a signed-in user saw the same
  // "come sign up" buttons as a stranger. Subscribes to auth changes (not
  // just a one-time check) so it updates immediately after sign-in/out
  // without needing a full page reload.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setCheckedAuth(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setMenuOpen(false)
    router.push('/')
    router.refresh()
  }

  return (
    <header className="site-header">
      <div className="site-header-bar">
        <Link href="/" className="site-header-logo" onClick={() => setMenuOpen(false)}>
          <GenstockLogo size={64} />
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 20 }}>Web2Ad</span>
        </Link>

        {!(checkedAuth && user) && (
          <nav className="site-header-nav-desktop">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="nav-link">{l.label}</Link>
            ))}
          </nav>
        )}

        <div className="site-header-actions-desktop" style={{ gridColumn: 3, paddingRight: 8 }}>
          {checkedAuth && (user ? (
            <AccountMenu user={user} onLogout={handleLogout} />
          ) : (
            <>
              <Link href="/login" className="nav-link plain">Login</Link>
              <Link href="/login?intent=signup" className="btn-gradient" style={{ padding: '9px 20px', fontSize: 14 }}>Sign Up</Link>
            </>
          ))}
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
            {checkedAuth && (user ? (
              <>
                <div style={{ fontSize: 12.5, color: 'var(--mist)', marginBottom: 4 }}>Signed in as {user.email}</div>
                <Link href="/adbuilder/projects" className="nav-link plain" onClick={() => setMenuOpen(false)}>My Ads</Link>
                <Link href="/pricing" className="nav-link plain" onClick={() => setMenuOpen(false)}>Billing</Link>
                <button type="button" onClick={handleLogout} className="nav-link plain" style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left', color: 'var(--danger)' }}>Log out</button>
              </>
            ) : (
              <>
                <Link href="/login" className="nav-link plain" onClick={() => setMenuOpen(false)}>Login</Link>
                <Link href="/login?intent=signup" className="btn-gradient" onClick={() => setMenuOpen(false)}>Sign Up</Link>
              </>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
