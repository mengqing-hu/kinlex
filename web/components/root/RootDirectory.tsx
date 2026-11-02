'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import type { MorphemeDirectoryItem } from '@/types/domain'

interface RootDirectoryLabels {
  empty: string
  searchLabel: string
  searchPlaceholder: string
  types: Record<string, string>
  word: string
  words: string
}

interface RootDirectoryProps {
  items: readonly MorphemeDirectoryItem[]
  labels: RootDirectoryLabels
  language: string
}

const morphemeTypes = ['prefix', 'root', 'suffix'] as const

export function RootDirectory({ items, labels, language }: RootDirectoryProps) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('de')
  const filteredItems = useMemo(
    () =>
      normalizedQuery
        ? items.filter((item) =>
            `${item.text} ${item.meaning}`.toLocaleLowerCase('de').includes(normalizedQuery),
          )
        : items,
    [items, normalizedQuery],
  )

  return (
    <div className="mt-10">
      <label className="block max-w-xl text-sm font-semibold text-[var(--ink)]">
        {labels.searchLabel}
        <input
          className="mt-2 min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 font-normal outline-none focus:border-[var(--info)] focus:ring-2 focus:ring-[var(--info)]/20"
          placeholder={labels.searchPlaceholder}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {filteredItems.length > 0 ? (
        <div className="mt-10 space-y-12">
          {morphemeTypes.map((type) => {
            const typeItems = filteredItems.filter((item) => item.type === type)
            if (typeItems.length === 0) return null

            return (
              <section aria-labelledby={`${type}-heading`} key={type}>
                <h2 className="text-2xl font-semibold text-[var(--ink)]" id={`${type}-heading`}>
                  {labels.types[type] ?? type}
                </h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {typeItems.map((item) => (
                    <li key={item.id}>
                      <Link
                        className="block rounded-xl border border-[var(--line)] bg-[var(--card)] p-4 hover:border-[var(--root)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
                        href={`/${language}/roots/${item.slug}`}
                      >
                        <span className="text-lg font-semibold text-[var(--ink)]">{item.text}</span>
                        <span className="mt-1 block text-sm text-[var(--mute)]">
                          {item.meaning}
                        </span>
                        <span className="mt-4 block text-xs font-semibold tracking-wide text-[var(--mute)] uppercase">
                          {item.wordCount} {item.wordCount === 1 ? labels.word : labels.words}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      ) : (
        <p className="mt-10 text-[var(--mute)]">{labels.empty}</p>
      )}
    </div>
  )
}
