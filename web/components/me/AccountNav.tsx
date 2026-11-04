'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const accountPages = [
  { href: '/me', label: 'Profile' },
  { href: '/me/settings', label: 'Settings' },
] as const

// A vertical list in the sidebar on wide screens, and a row of tabs above the content on phones.
export function AccountNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Account sections">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {accountPages.map((page) => {
          const isCurrent = pathname === page.href
          return (
            <li key={page.href}>
              <Link
                aria-current={isCurrent ? 'page' : undefined}
                className={`block rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none ${
                  isCurrent
                    ? 'bg-[var(--bg)] font-semibold text-[var(--ink)]'
                    : 'text-[var(--mute)] hover:bg-[var(--bg)] hover:text-[var(--ink)]'
                }`}
                href={page.href}
              >
                {page.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
