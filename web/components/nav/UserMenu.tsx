'use client'

import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { AccountMenu } from '@/components/auth/AccountMenu'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { flushEventQueue } from '@/lib/client/eventQueue'
import { mergeLocalFamiliarity } from '@/lib/client/localFamiliarity'
import { mergeLocalFavorites } from '@/lib/client/localFavorites'

interface UserMenuProps {
  accountLabel: string
  signInLabel: string
}

export function UserMenu({ accountLabel, signInLabel }: UserMenuProps) {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    const supabase = getBrowserSupabase()
    let isMounted = true

    void supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setUser(data.session?.user ?? null)
      }
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null)
      }
      if (session) {
        void mergeLocalFavorites()
        void mergeLocalFamiliarity()
        void flushEventQueue()
      }
    })

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  if (user === undefined) {
    // Reserve the account row's space while the session loads, so the sidebar does not jump.
    return <span aria-hidden="true" className="block h-11" />
  }

  if (user) {
    return <AccountMenu label={accountLabel} user={user} />
  }

  return (
    <div className="space-y-1.5">
      <Link
        className="md:sidebar-collapsed:hidden block rounded-md bg-[var(--ink)] px-3 py-2 text-center text-sm font-medium text-[var(--card)] transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
        href="/login"
      >
        {signInLabel}
      </Link>
      <GoogleSignInButton
        accessibleLabel="Sign in with Google"
        className="md:sidebar-collapsed:px-0 w-full rounded-md border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:border-[var(--info)]"
        label="Google"
        labelClassName="md:sidebar-collapsed:hidden"
      />
    </div>
  )
}
