import 'server-only'

import { getLocale } from 'next-intl/server'

import { redirect } from '@/i18n/navigation'
import { getSupabase } from '@/lib/supabase/server'

// Each account page redirects on its own so that the login page can send the user back to it.
// nextPath leaves out the language, which the login page and the sign-in callback keep.
export async function requireUser(nextPath: string) {
  const supabase = await getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect({ href: { pathname: '/login', query: { next: nextPath } }, locale: await getLocale() })
  }

  return { supabase, user }
}
