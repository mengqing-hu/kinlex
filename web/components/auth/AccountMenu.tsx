'use client'

import type { User } from '@supabase/supabase-js'

import { Avatar } from '@/components/ui/Avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Link, useRouter } from '@/i18n/navigation'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import type { UserProfile } from '@/types/domain'

const accountPages = [
  { href: '/me', label: 'Profile' },
  { href: '/me/settings', label: 'Settings' },
] as const

// Google sign-ins fill full_name; magic-link users only have an email.
function getDisplayName(user: User) {
  const fullName: unknown = user.user_metadata.full_name ?? user.user_metadata.name
  return typeof fullName === 'string' && fullName.trim() ? fullName.trim() : null
}

interface AccountMenuProps {
  label?: string
  user: User
  profile: UserProfile | null
}

export function AccountMenu({ label = 'Account', user, profile }: AccountMenuProps) {
  const router = useRouter()
  const displayName = profile?.displayName ?? getDisplayName(user)
  const name = displayName ?? user.email ?? '?'

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
          <Avatar
            className="size-8 bg-[var(--ink)] text-xs text-[var(--card)]"
            name={name}
            url={profile?.avatarUrl ?? null}
          />
          {/* Only the name: the email is in the menu that opens. */}
          <span className="md:sidebar-collapsed:hidden block min-w-0 flex-1 truncate text-sm font-medium text-[var(--ink)]">
            {name}
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
