'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { PanelCloseButton, panelSectionLabelClass, SidePanel } from '@/components/ui/SidePanel'
import { fetchApiData } from '@/lib/client/apiClient'
import { openWordPanelOnClick } from '@/lib/client/searchParams'
import { formatPartOfSpeech } from '@/lib/utils/partOfSpeech'
import { getWordPanelPath } from '@/lib/wordPanel'
import type { MorphemeDirectoryItem, MorphemeWord, MorphemeWordCollection } from '@/types/domain'

export interface MorphemePanelLabels {
  close: string
  loading: string
  loadError: string
  retry: string
  meaning: string
  words: string
  noWords: string
  separable: string
  openList: string
  morphemeTypes: Record<string, string>
  partsOfSpeech: Record<string, string>
}

// The most words the API returns for one morpheme; more than any word part has.
const WORD_LIMIT = 500

const morphemeColors: Record<string, string> = {
  prefix: 'text-[var(--prefix)]',
  root: 'text-[var(--root)]',
  suffix: 'text-[var(--suffix)]',
}

interface PanelState {
  morphemeId: number
  words: MorphemeWord[] | null
  error: boolean
}

interface MorphemeDetailPanelProps {
  language: string
  morpheme: MorphemeDirectoryItem
  // Such as "112 words".
  wordCount: string
  labels: MorphemePanelLabels
  onClose: () => void
}

export function MorphemeDetailPanel({
  language,
  morpheme,
  wordCount,
  labels,
  onClose,
}: MorphemeDetailPanelProps) {
  const [state, setState] = useState<PanelState>({ morphemeId: 0, words: null, error: false })
  const [retryVersion, setRetryVersion] = useState(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const isLoading = state.morphemeId !== morpheme.id

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ lang: language, limit: String(WORD_LIMIT) })

    void fetchApiData<MorphemeWordCollection>(`/api/v1/morphemes/${morpheme.id}/words?${params}`, {
      signal: controller.signal,
    })
      .then(({ words }) => setState({ morphemeId: morpheme.id, words, error: false }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        setState({ morphemeId: morpheme.id, words: null, error: true })
      })

    return () => controller.abort()
  }, [language, morpheme.id, retryVersion])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [morpheme.id])

  const words = isLoading ? null : state.words
  const meta = [
    labels.morphemeTypes[morpheme.type] ?? morpheme.type,
    morpheme.separable ? labels.separable : null,
    wordCount,
  ].filter(Boolean)

  return (
    <SidePanel busy={isLoading} label={morpheme.text} onClose={onClose}>
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4" ref={bodyRef}>
        <article className="space-y-4">
          {/* Stays at the top while the words scroll, so the word part and close button remain
              in view. */}
          <header className="sticky top-0 z-10 -mx-4 -mt-3 border-b border-[var(--line)] bg-[var(--card)] px-4 pt-3 pb-2">
            <div className="flex items-center gap-0.5">
              <h2
                className={`min-w-0 flex-1 truncate text-xl font-semibold tracking-tight ${morphemeColors[morpheme.type] ?? 'text-[var(--ink)]'}`}
              >
                {morpheme.text}
              </h2>
              <PanelCloseButton label={labels.close} onClose={onClose} />
            </div>
            <p className="mt-0.5 text-xs text-[var(--mute)]">{meta.join(' · ')}</p>
          </header>

          <section>
            <h3 className={panelSectionLabelClass}>{labels.meaning}</h3>
            <p className="text-sm leading-5 text-[var(--ink)]">{morpheme.meaning}</p>
          </section>

          <section>
            <h3 className={panelSectionLabelClass}>{labels.words}</h3>
            {words ? (
              words.length > 0 ? (
                <ul className="divide-y divide-[var(--line)]">
                  {words.map((word) => (
                    <li className="py-2 first:pt-0 last:pb-0" key={word.id}>
                      <div className="flex items-baseline gap-1.5">
                        <Link
                          className="font-semibold text-[var(--ink)] hover:text-[var(--root)] hover:underline"
                          href={getWordPanelPath(language, word.slug, word.level)}
                          onClick={(event) => openWordPanelOnClick(event, word.slug)}
                        >
                          {word.segments.length > 0
                            ? word.segments.map((segment, index) => (
                                <span
                                  className={
                                    segment.morphemeId === morpheme.id
                                      ? (morphemeColors[morpheme.type] ?? '')
                                      : ''
                                  }
                                  key={`${index}-${segment.surface}`}
                                >
                                  {segment.surface}
                                </span>
                              ))
                            : word.lemma}
                        </Link>
                        <span className="truncate text-xs text-[var(--mute)]">
                          {[
                            formatPartOfSpeech(labels.partsOfSpeech, word.pos, word.posDetail),
                            word.level,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </div>
                      {word.glosses.length > 0 ? (
                        <p className="text-sm leading-5 text-[var(--ink)]">
                          {word.glosses.join(', ')}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--mute)]">{labels.noWords}</p>
              )
            ) : !isLoading && state.error ? (
              <div className="py-6 text-center">
                <p className="text-sm text-[var(--mute)]">{labels.loadError}</p>
                <button
                  className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:border-[var(--info)]"
                  type="button"
                  onClick={() => {
                    setState((current) => ({ ...current, morphemeId: 0 }))
                    setRetryVersion((version) => version + 1)
                  }}
                >
                  {labels.retry}
                </button>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-[var(--mute)]" role="status">
                {labels.loading}
              </p>
            )}
          </section>

          {/* The root's own page lists its words with the word list's filters and sorts. */}
          <Link
            className="inline-block text-sm font-semibold text-[var(--mute)] hover:text-[var(--ink)]"
            href={`/${language}/roots/${morpheme.slug}`}
          >
            {labels.openList}
          </Link>
        </article>
      </div>
    </SidePanel>
  )
}
