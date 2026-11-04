import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'

import { AccountSync } from '@/components/me/AccountSync'
import { AccountTabs } from '@/components/me/AccountTabs'
import { TopNav } from '@/components/nav/TopNav'
import { getLanguageDefinition, supportedLanguageCodes } from '@/lib/languages'
import { getProfile } from '@/lib/services/profileService'
import { getSupabase } from '@/lib/supabase/server'

import { signOut } from './actions'

export default async function AccountLayout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Signed-out visitors are redirected by the page itself, which knows its own path.
  if (!user) {
    return children
  }

  // Account pages are not tied to a learning language yet, so the nav points at the only one.
  const [lang] = supportedLanguageCodes
  const [profile, navigation] = await Promise.all([
    getProfile(supabase, user.id),
    getTranslations('navigation'),
  ])

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav
        language={lang}
        labels={{
          account: navigation('account'),
          home: navigation('home'),
          learningLanguage: navigation('learningLanguage', {
            language: getLanguageDefinition(lang).name,
          }),
          mainNavigation: navigation('mainNavigation'),
          signIn: navigation('signIn'),
        }}
      />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <AccountSync />
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
              Account
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {profile.displayName ?? user.email}
            </h1>
            {profile.displayName ? (
              <p className="mt-0.5 text-sm text-[var(--mute)]">{user.email}</p>
            ) : null}
          </div>

          <form action={signOut}>
            <button
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </header>
        <AccountTabs />
        <div className="mt-8">{children}</div>
      </main>
    </div>
  )
}
