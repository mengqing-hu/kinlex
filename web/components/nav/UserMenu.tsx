'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { getBrowserSupabase } from '@/lib/supabase/browser'
import { flushEventQueue } from '@/lib/client/eventQueue'
import { mergeLocalFavorites } from '@/lib/client/localFavorites'

interface UserMenuProps {
  accountLabel: string
  signInLabel: string
}

export function UserMenu({ accountLabel, signInLabel }: UserMenuProps) {
  const [isSignedIn, setIsSignedIn] = useState(false)

  useEffect(() => {
    const supabase = getBrowserSupabase()
    let isMounted = true

    void supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setIsSignedIn(Boolean(data.session))
      }
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setIsSignedIn(Boolean(session))
      }
      if (session) {
        void mergeLocalFavorites()
        void flushEventQueue()
      }
    })

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  return (
    <Link
      className="rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--info)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
      href={isSignedIn ? '/me' : '/login'}
    >
      {isSignedIn ? accountLabel : signInLabel}
    </Link>
  )
}
