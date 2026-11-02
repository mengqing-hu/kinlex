'use client'

import { useState } from 'react'

interface SearchBoxProps {
  compact?: boolean
  defaultValue?: string
  label: string
  placeholder: string
}

export function SearchBox({
  compact = false,
  defaultValue = '',
  label,
  placeholder,
}: SearchBoxProps) {
  const [query, setQuery] = useState(defaultValue)

  return (
    <form action="/search" className={compact ? 'hidden md:block' : 'w-full'} role="search">
      <label className="sr-only" htmlFor={compact ? 'nav-search' : 'page-search'}>
        {label}
      </label>
      <input type="hidden" name="lang" value="de" />
      <input
        className={`${compact ? 'w-40' : 'w-full'} min-h-10 rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 text-sm outline-none focus:border-[var(--info)] focus:ring-2 focus:ring-[var(--info)]/20`}
        id={compact ? 'nav-search' : 'page-search'}
        name="q"
        placeholder={placeholder}
        required
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
    </form>
  )
}
