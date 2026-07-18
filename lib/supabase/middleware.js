import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// Standard Supabase/Next.js App Router session-refresh pattern — without
// this, a signed-in user's session can silently expire mid-visit since
// Server Components can't write cookies themselves (see server.js's
// no-op setAll catch).
export async function updateSession(request) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}
