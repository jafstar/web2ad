// Real pack economics, not yet validated against actual margin data (that
// comes later from credit_transactions.api_cost_usd once real usage
// exists) — a reasonable starting point: $10 at ~20c/credit, $20 with a
// bulk discount at ~16.7c/credit. Easy to adjust before or after launch,
// this is the single place it lives.
export const PACKS = {
  '$10': { label: '$10', credits: 50, amountCents: 1000, priceIdEnvVar: 'STRIPE_PRICE_ID_10' },
  '$20': { label: '$20', credits: 120, amountCents: 2000, priceIdEnvVar: 'STRIPE_PRICE_ID_20' },
}
