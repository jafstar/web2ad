import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS. Only ever imported from server-side
// code (API routes), never sent to the browser: debit_credits/
// credit_purchase RPCs and the Stripe webhook need to write rows that
// aren't the logged-in user's own request context (e.g. the webhook has
// no user session at all, just a user_id looked up from the Checkout
// session's metadata).
export function createAdminClient() {
  const key = process.env.SUPABASE_GEN_SECRET_KEY
  if (!key) throw new Error('SUPABASE_GEN_SECRET_KEY is not set')

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    key,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
