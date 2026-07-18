// Thin wrapper around the debit_credits/credit_purchase Postgres functions
// (supabase/migrations/0001_credits_schema.sql) — those functions are the
// real transaction boundary (row lock + debit + ledger insert in one DB
// transaction), this module just calls them, it doesn't reimplement them.
export const CREDIT_COST_PER_IMAGE = 1

// TEMPORARY, shared with app/api/credits/check/route.js — testing the
// ported Photos flow without credits blocking generation. Flip to false
// to restore real gating in both places at once.
export const CREDITS_DISABLED_FOR_TESTING = true

// Throws 'insufficient_credits' (propagated from the SQL function) if the
// user can't cover the cost — callers should catch and return a 402-style
// response, not let this bubble as a generic 500.
export async function debitCredits(adminClient, userId, amount, { type = 'round', apiCostUsd = null, roundTier = null } = {}) {
  const { data, error } = await adminClient.rpc('debit_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_api_cost_usd: apiCostUsd,
    p_round_tier: roundTier,
  })
  if (error) throw new Error(error.message)
  return data // new balance
}

export async function getBalance(adminClient, userId) {
  const { data, error } = await adminClient
    .from('credit_balances')
    .select('balance')
    .eq('user_id', userId)
    .single()
  if (error) throw new Error(error.message)
  return data.balance
}
