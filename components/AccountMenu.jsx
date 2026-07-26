'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// Real account dropdown - replaces the plain "My Ads"/"Log out" text
// links that sat flush against the header's right edge with no breathing
// room. A circular avatar button (first letter of the real signed-in
// email) opens a menu showing who you're signed in as plus the actual
// account actions, closing on outside click or Escape.
export default function AccountMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initial = (user.email || '?')[0].toUpperCase()

  return (
    <div ref={ref} style={{ position: 'relative', marginRight: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        style={{
          width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'var(--accent-gradient)', color: '#fff', fontWeight: 600, fontSize: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {initial}
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 220,
            padding: 8, zIndex: 60, background: '#0a0a0a',
          }}
        >
          <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Signed in as</div>
            <div style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
          </div>

          <Link href="/adbuilder" className="nav-link plain" onClick={() => setOpen(false)} style={{ display: 'block', padding: '9px 10px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>Create New</Link>
          <Link href="/adbuilder/projects" className="nav-link plain" onClick={() => setOpen(false)} style={{ display: 'block', padding: '9px 10px', borderRadius: 8, fontSize: 14 }}>My Ads</Link>
          <Link href="/adbuilder/playground" className="nav-link plain" onClick={() => setOpen(false)} style={{ display: 'block', padding: '9px 10px', borderRadius: 8, fontSize: 14 }}>Playground</Link>
          <Link href="/pricing" className="nav-link plain" onClick={() => setOpen(false)} style={{ display: 'block', padding: '9px 10px', borderRadius: 8, fontSize: 14 }}>Billing</Link>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 6, paddingTop: 6 }}>
            <button
              type="button"
              onClick={() => { setOpen(false); onLogout() }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8,
                background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 14, color: 'var(--danger)',
              }}
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
