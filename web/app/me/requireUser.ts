import 'server-only'

import { redirect } from 'next/navigation'

import { getSupabase } from '@/lib/supabase/server'

// Each account page redirects on its own so that the login page can send the user back to it.
export async function requireUser(nextPath: string) {
  const supabase = await getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  return { supabase, user }
}
