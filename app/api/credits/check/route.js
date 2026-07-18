import { createClient } from '../../../../lib/supabase/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { getBalance, CREDITS_DISABLED_FOR_TESTING } from '../../../../lib/credits'

// Real counterpart to designpipe-app's ipcMain.handle('credits:check', ...)
// stub — same channel/shape via the ipc shim, so ported GenerateVariations
// code calls this identically regardless of which app it's running in.
export async function GET(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const cost = Number(new URL(request.url).searchParams.get('cost')) || 0
  const admin = createAdminClient()
  const balance = await getBalance(admin, user.id)

  if (CREDITS_DISABLED_FOR_TESTING) {
    return Response.json({ ok: true, unlimited: true, balance })
  }
  return Response.json({ ok: balance >= cost, unlimited: false, balance })
}
