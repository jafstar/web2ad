import { createClient } from '../../../lib/supabase/server'
import { NextResponse } from 'next/server'

// `next` only ever honored as a same-origin relative path (must start
// with a single "/", not "//" which browsers treat as protocol-relative
// to an attacker-controlled host) - real open-redirect guard, since this
// value round-trips through an email link before landing back here.
function safeNext(next) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/app'
  return next
}

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/login`)
}
