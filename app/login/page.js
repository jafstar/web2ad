'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import SiteHeader from '../../components/SiteHeader'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const isSignup = searchParams.get('intent') === 'signup'
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const sendLink = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />

      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 24px 96px' }}>
        <div className="card" style={{ maxWidth: 400, width: '100%', padding: 32 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>{isSignup ? 'get started' : 'welcome back'}</div>
          <h1 style={{ fontSize: 26, marginBottom: 10 }}>{isSignup ? 'Create your account' : 'Sign in'}</h1>
          {sent ? (
            <p style={{ color: 'var(--mist)', fontSize: 14.5, lineHeight: 1.6 }}>
              Check {email} for a sign-in link.
            </p>
          ) : (
            <form onSubmit={sendLink}>
              <p style={{ color: 'var(--mist)', fontSize: 14.5, marginBottom: 20, lineHeight: 1.6 }}>
                No password — we'll email you a link.
              </p>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ height: 48, marginBottom: 14 }}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={busy}
                style={{ width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {busy ? 'Sending…' : 'Send sign-in link'}
              </button>
              {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{error}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
