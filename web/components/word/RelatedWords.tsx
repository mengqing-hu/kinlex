import Link from 'next/link'

import { formatPartOfSpeech } from '@/lib/utils/partOfSpeech'
import type { RelatedWord } from '@/types/domain'

interface RelatedWordsProps {
  language: string
  words: RelatedWord[]
  emptyMessage: string
  partOfSpeechLabels: Record<string, string>
}

export function RelatedWords({
  language,
  words,
  emptyMessage,
  partOfSpeechLabels,
}: RelatedWordsProps) {
  if (words.length === 0) {
    return <p className="text-[var(--mute)]">{emptyMessage}</p>
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {words.map((word) => (
        <li key={word.id}>
          <Link
            className="block rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2.5 transition-colors hover:border-[var(--root)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--info)]"
            href={`/${encodeURIComponent(language)}/word/${encodeURIComponent(word.slug)}`}
          >
            <span className="font-semibold text-[var(--ink)]">
              {word.lemma}
            </span>
            <span className="mt-0.5 block text-xs text-[var(--mute)]">
              {formatPartOfSpeech(partOfSpeechLabels, word.pos, word.posDetail)}
              {word.level ? ` · ${word.level}` : ''}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
