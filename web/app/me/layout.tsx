import type { ReactNode } from 'react'

import { AccountSync } from '@/components/me/AccountSync'
import { AppShell } from '@/components/nav/AppShell'
import { supportedLanguageCodes } from '@/lib/languages'
import { getSupabase } from '@/lib/supabase/server'

export default async function AccountLayout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Signed-out visitors are redirected by the page itself, which knows its own path.
  if (!user) {
    return children
  }

  return (
    // Account pages are not tied to a learning language yet, so the nav uses the only one.
    <AppShell language={supportedLanguageCodes[0]}>
      <AccountSync />
      <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 space-y-5 px-5 py-6 sm:px-8">
        {children}
      </main>
    </AppShell>
  )
}
