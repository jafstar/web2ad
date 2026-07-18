// Real usage caps for the soft-launch beta - directly addresses the
// "whale/cost risk" every model in the launch-plan council flagged
// independently: an unchecked user generating across 3 engines with no
// cap could run up a real API bill fast. Operator account(s) are exempt
// so building/testing isn't itself capped.
export const PROJECT_LIMIT = 3
export const ROUND_LIMIT_PER_PROJECT = 8

const WHITELISTED_EMAILS = new Set([
  'jafar104@gmail.com',
])

export function isWhitelisted(email) {
  return !!email && WHITELISTED_EMAILS.has(email.toLowerCase())
}
