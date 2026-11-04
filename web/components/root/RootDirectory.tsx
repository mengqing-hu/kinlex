import Link from 'next/link'

import type { MorphemeDirectoryItem } from '@/types/domain'

interface RootDirectoryLabels {
  empty: string
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
  return (
    <div>
      {items.length > 0 ? (
        <div className="space-y-12">
          {morphemeTypes.map((type) => {
            const typeItems = items.filter((item) => item.type === type)
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
        <p className="text-[var(--mute)]">{labels.empty}</p>
      )}
    </div>
  )
}
