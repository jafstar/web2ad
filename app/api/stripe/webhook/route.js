import { getStripe } from '../../../../lib/stripe'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { PACKS } from '../../../../lib/packs'

// Server-to-server only — this is the real source of truth for crediting
// a purchase, never the client-side success redirect (spoofable). Needs
// the RAW request body for signature verification, so this route must
// never run request.json() before constructEvent.
export async function POST(request) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) return Response.json({ error: 'Webhook not configured' }, { status: 503 })

  const signature = request.headers.get('stripe-signature')
  const rawBody = await request.text()

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    return Response.json({ error: `Signature verification failed: ${err.message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const userId = session.metadata?.user_id
    const packKey = session.metadata?.pack
    const packConfig = PACKS[packKey]

    if (!userId || !packConfig) {
      return Response.json({ error: 'Missing/unknown user_id or pack in session metadata' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin.rpc('credit_purchase', {
      p_user_id: userId,
      p_stripe_session_id: session.id,
      p_pack: packKey,
      p_credits_granted: packConfig.credits,
      p_amount_cents: session.amount_total,
    })

    // stripe_session_id's unique constraint (23505) is the real idempotency
    // guard — Stripe retries this webhook on network issues, and a retry
    // hitting an already-processed session must be a no-op, not a second
    // credit grant. Any other error is real and should surface as a 500
    // so Stripe retries (this webhook genuinely didn't succeed yet).
    if (error && error.code !== '23505') {
      return Response.json({ error: error.message }, { status: 500 })
    }
  }

  return Response.json({ received: true })
}
