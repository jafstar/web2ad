import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'
import HomeShell from './HomeShell'

export default async function AppPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <HomeShell userEmail={user.email} />
}
