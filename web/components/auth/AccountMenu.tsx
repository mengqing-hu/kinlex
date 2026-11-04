'use client'

import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { accountPages } from '@/components/me/AccountTabs'
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
          className="inline-flex size-9 items-center justify-center rounded-full bg-[var(--ink)] text-sm font-semibold text-[var(--card)] transition-opacity outline-none hover:opacity-85 focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:ring-offset-2"
          type="button"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
