import Link from 'next/link'

import type { FavoriteWord } from '@/types/domain'

export function FavoritesList({ words }: { words: readonly FavoriteWord[] }) {
  return (
    <section aria-labelledby="favorites-heading">
      <h2 className="text-lg font-semibold" id="favorites-heading">
        Favorites
      </h2>
      {words.length > 0 ? (
        <ul className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {words.map((word) => (
            <li key={word.id}>
              <Link
                className="flex items-center justify-between gap-4 py-2.5"
                href={`/de/word/${word.slug}`}
              >
                <span>
                  <strong>{word.lemma}</strong>
                  <span className="ml-2 text-sm text-[var(--mute)]">{word.pos}</span>
                </span>
                <span className="text-sm text-[var(--mute)]">{word.level}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[var(--mute)]">You have not saved any words yet.</p>
      )}
    </section>
  )
}
