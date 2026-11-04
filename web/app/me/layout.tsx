import Link from 'next/link'
import type { ReactNode } from 'react'

import { AccountNav } from '@/components/me/AccountNav'
import { AccountSync } from '@/components/me/AccountSync'
import { AppShell } from '@/components/nav/AppShell'
import { supportedLanguageCodes } from '@/lib/languages'
import { getProfile } from '@/lib/services/profileService'
import { getSupabase } from '@/lib/supabase/server'

import { signOut } from './actions'

const memberSinceFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const providerNames: Record<string, string> = { email: 'Email link', google: 'Google' }

export default async function AccountLayout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Signed-out visitors are redirected by the page itself, which knows its own path.
  if (!user) {
    return children
  }

  const profile = await getProfile(supabase, user.id)
  const googleName: unknown = user.user_metadata.full_name ?? user.user_metadata.name
  const displayName =
    profile.displayName ?? (typeof googleName === 'string' && googleName ? googleName : null)
  const initial = (displayName ?? user.email ?? '?').charAt(0).toUpperCase()
  const provider = typeof user.app_metadata.provider === 'string' ? user.app_metadata.provider : ''
  const details = [
    ['Signed in with', providerNames[provider] ?? provider],
    ['Member since', memberSinceFormat.format(new Date(user.created_at))],
  ]

  return (
    // Account pages are not tied to a learning language yet, so the nav uses the only one.
    <AppShell language={supportedLanguageCodes[0]}>
      <AccountSync />
      <div className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-5 px-5 py-6 sm:px-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-6">
          <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
            <div className="flex items-center gap-3 lg:flex-col lg:items-start">
              <span
                aria-hidden="true"
                className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-xl font-semibold text-[var(--card)] lg:size-20 lg:text-3xl"
              >
                {initial}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight">
                  {displayName ?? user.email}
                </h1>
                {displayName ? (
                  <p className="truncate text-sm text-[var(--mute)]">{user.email}</p>
                ) : null}
              </div>
            </div>

            <Link
              className="mt-4 block rounded-md bg-[var(--root)]/12 px-3 py-2 text-center text-sm font-medium text-[var(--root)] transition-colors hover:bg-[var(--root)]/20"
              href="/me/settings"
            >
              Edit profile
            </Link>

            <dl className="mt-4 space-y-2 border-t border-[var(--line)] pt-4 text-sm">
              {details.map(([label, value]) => (
                <div className="flex justify-between gap-3" key={label}>
                  <dt className="text-[var(--mute)]">{label}</dt>
                  <dd className="truncate font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-2">
            <AccountNav />
            <form
              action={signOut}
              className="mt-1 hidden border-t border-[var(--line)] pt-1 lg:block"
            >
              <button
                className="w-full rounded-md px-3 py-2 text-left text-sm text-[var(--mute)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--ink)]"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </section>
        </aside>

        <main className="min-w-0 space-y-5">{children}</main>
      </div>
    </AppShell>
  )
}
