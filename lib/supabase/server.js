import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Real user-session-aware client for Server Components/Route Handlers —
// respects RLS as the logged-in user, not the service role.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component without a response to attach
            // to — middleware.js is what actually persists the refreshed
            // session in that case, so this is safe to ignore here.
          }
        },
      },
    }
  )
}
