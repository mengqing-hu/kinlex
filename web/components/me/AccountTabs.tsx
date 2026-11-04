'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const accountPages = [
  { href: '/me', label: 'Profile' },
  { href: '/me/favorites', label: 'Favorites' },
  { href: '/me/settings', label: 'Settings' },
] as const

export function AccountTabs() {
  const pathname = usePathname()

  return (
    <nav aria-label="Account sections" className="mt-6 flex gap-1 border-b border-[var(--line)]">
      {accountPages.map((page) => {
        const isCurrent = pathname === page.href
        return (
          <Link
            aria-current={isCurrent ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              isCurrent
                ? 'border-[var(--ink)] text-[var(--ink)]'
                : 'border-transparent text-[var(--mute)] hover:text-[var(--ink)]'
            }`}
            href={page.href}
            key={page.href}
          >
            {page.label}
          </Link>
        )
      })}
    </nav>
  )
}
