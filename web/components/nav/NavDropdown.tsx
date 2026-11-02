'use client'

import Link from 'next/link'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'

export interface NavDropdownItem {
  href: string
  label: string
  current?: boolean
}

interface NavDropdownProps {
  items: readonly NavDropdownItem[]
  label: string
}

export function NavDropdown({ items, label }: NavDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--mute)] transition-colors outline-none hover:bg-[var(--bg)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--info)]"
          type="button"
        >
          {label}
          <svg aria-hidden="true" className="size-3" viewBox="0 0 12 12">
            <path d="m2.5 4.5 3.5 3 3.5-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {items.map((item) => (
          <DropdownMenuItem asChild key={item.href}>
            <Link
              aria-current={item.current ? 'page' : undefined}
              className={item.current ? 'bg-[var(--bg)] text-[var(--ink)]' : ''}
              href={item.href}
            >
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
