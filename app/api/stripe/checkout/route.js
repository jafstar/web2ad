import { createClient } from '../../../../lib/supabase/server'
import { getStripe } from '../../../../lib/stripe'
import { PACKS } from '../../../../lib/packs'

// One-time payment (not subscription), per genstock-credits-schema.md —
// Stripe never sees "credits", it just processes a payment; the webhook
// (app/api/stripe/webhook/route.js) is the source of truth for crediting.
export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const { pack } = await request.json()
  const packConfig = PACKS[pack]
  if (!packConfig) return Response.json({ error: 'Unknown pack' }, { status: 400 })

  const priceId = process.env[packConfig.priceIdEnvVar]
  if (!priceId) {
    return Response.json({ error: `${packConfig.priceIdEnvVar} not configured yet` }, { status: 503 })
  }

  const stripe = getStripe()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    // Real per-user identity carried through to the webhook — Stripe has
    // no concept of our users, this metadata is the only link back.
    metadata: { user_id: user.id, pack },
    success_url: `${siteUrl}/app?purchase=success`,
    cancel_url: `${siteUrl}/app?purchase=cancelled`,
  })

  return Response.json({ url: session.url })
}
