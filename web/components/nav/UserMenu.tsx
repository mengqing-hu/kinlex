'use client'

import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { AccountMenu } from '@/components/auth/AccountMenu'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { flushEventQueue } from '@/lib/client/eventQueue'
import { mergeLocalFamiliarity } from '@/lib/client/localFamiliarity'
import { mergeLocalFavorites } from '@/lib/client/localFavorites'

interface UserMenuProps {
  accountLabel: string
  signInLabel: string
}

export function UserMenu({ accountLabel, signInLabel }: UserMenuProps) {
  const [user, setUser] = useState<User | null>(null)

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

  if (user) {
    return <AccountMenu label={accountLabel} user={user} />
  }

  return (
    <Link
      className="rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--info)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
      href="/login"
    >
      {signInLabel}
    </Link>
  )
}
