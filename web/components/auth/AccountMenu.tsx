'use client'

import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { accountPages } from '@/components/me/AccountNav'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { getBrowserSupabase } from '@/lib/supabase/browser'

// Google sign-ins fill full_name; magic-link users only have an email.
function getDisplayName(user: User) {
  const fullName: unknown = user.user_metadata.full_name ?? user.user_metadata.name
  return typeof fullName === 'string' && fullName.trim() ? fullName.trim() : null
}

interface AccountMenuProps {
  label?: string
  user: User
}

export function AccountMenu({ label = 'Account', user }: AccountMenuProps) {
  const router = useRouter()
  const displayName = getDisplayName(user)
  const initial = (displayName ?? user.email ?? '?').charAt(0).toUpperCase()

  async function signOut() {
    await getBrowserSupabase().auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={label}
          className="md:sidebar-collapsed:justify-center md:sidebar-collapsed:px-0 flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors outline-none hover:bg-[var(--bg)] focus-visible:ring-2 focus-visible:ring-[var(--info)]"
          type="button"
        >
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-sm font-semibold text-[var(--card)]">
            {initial}
          </span>
          <span className="md:sidebar-collapsed:hidden min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-[var(--ink)]">
              {displayName ?? user.email}
            </span>
            {displayName ? (
              <span className="block truncate text-xs text-[var(--mute)]">{user.email}</span>
            ) : null}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" side="right" sideOffset={12}>
        <div className="px-3 py-2">
          {displayName ? <p className="truncate text-sm font-semibold">{displayName}</p> : null}
          <p className="truncate text-xs text-[var(--mute)]">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        {accountPages.map((item) => (
          <DropdownMenuItem asChild key={item.href}>
            <Link href={item.href}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
