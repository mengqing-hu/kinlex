import type { Metadata } from 'next'
import Link from 'next/link'

import { SearchBox } from '@/components/nav/SearchBox'
import { searchWords } from '@/lib/services/searchService'
import { getPublicSupabase } from '@/lib/supabase/server'
import { getWordPanelPath } from '@/lib/wordPanel'

export const metadata: Metadata = {
  title: 'Search German vocabulary',
  description: 'Search German words and approximate spellings.',
}

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getParam(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : ''
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const rawQuery = getParam(params.q)
  const language = getParam(params.lang) || 'de'
  const result = rawQuery
    ? await searchWords(getPublicSupabase(), language, rawQuery, 50)
    : { query: '', items: [] }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
      <Link className="text-lg font-semibold" href="/">
        Kinlex
      </Link>
      <header className="mt-10 max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">Search German vocabulary</h1>
        <p className="mt-4 text-[var(--mute)]">
          Search by dictionary form or approximate spelling.
        </p>
      </header>
      <div className="mt-8 max-w-xl">
        <SearchBox
          defaultValue={result.query}
          label="Search German vocabulary"
          placeholder="Search words"
        />
      </div>
      {result.query ? (
        result.items.length > 0 ? (
          <section className="mt-10" aria-label="Search results">
            <p className="text-sm text-[var(--mute)]">Results for “{result.query}”</p>
            <ul className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {result.items.map((word) => (
                <li key={word.id}>
                  <Link
                    className="flex items-start justify-between gap-4 py-5"
                    href={getWordPanelPath('de', word.slug, word.level)}
                  >
                    <span>
                      <strong className="text-lg text-[var(--ink)]">{word.lemma}</strong>
                      <span className="mt-1 block text-sm text-[var(--mute)]">
                        {word.gloss ?? word.pos}
                      </span>
                    </span>
                    <span className="text-sm text-[var(--mute)]">{word.level}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="mt-10 text-[var(--mute)]">No words matched “{result.query}”.</p>
        )
      ) : null}
    </main>
  )
}
