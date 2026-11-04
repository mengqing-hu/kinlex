'use client'

import Link from 'next/link'
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

import { WordViewTracker } from '@/components/activity/WordViewTracker'
import { AudioButton } from '@/components/audio/AudioButton'
import { FavoriteButton } from '@/components/favorite/FavoriteButton'
import { ExampleLine } from '@/components/word/ExampleLine'
import { MorphemeText } from '@/components/word/MorphemeText'
import { fetchApiData } from '@/lib/client/apiClient'
import { formatPartOfSpeech } from '@/lib/utils/partOfSpeech'
import { openWordPanelOnClick } from '@/lib/client/searchParams'
import { getWordPanelPath, WORD_PANEL_SLOT_ID } from '@/lib/wordPanel'
import type { WordDetail } from '@/types/domain'

function subscribeToNothing() {
  return () => undefined
}

function getPanelSlot() {
  return document.getElementById(WORD_PANEL_SLOT_ID)
}

export interface WordPanelLabels {
  close: string
  loading: string
  loadError: string
  retry: string
  // Raw message templates with {plural} and {word} placeholders.
  plural: string
  playWord: string
  meaning: string
  structure: string
  examples: string
  wordFamily: string
  noExamples: string
  noRelatedWords: string
  playExample: string
  slowAudio: string
  morphemeTypes: Record<string, string>
  partsOfSpeech: Record<string, string>
}

const iconButtonClass =
  'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--mute)] hover:bg-[var(--bg)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none'
const strokeIcon = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 1.8,
  viewBox: '0 0 24 24',
} as const
const sectionLabelClass =
  'mb-1.5 text-[11px] font-semibold tracking-wider text-[var(--mute)] uppercase'
const morphemeColors: Record<string, string> = {
  prefix: 'text-[var(--prefix)]',
  root: 'text-[var(--root)]',
  suffix: 'text-[var(--suffix)]',
}

// A denser layout than the full word page: one header row, small section labels instead of
// headings and dividers, and inline lists instead of cards, so the narrow column reads at a glance.
function PanelWord({
  actions,
  language,
  labels,
  word,
}: {
  actions: ReactNode
  language: string
  labels: WordPanelLabels
  word: WordDetail
}) {
  const meta = [
    formatPartOfSpeech(labels.partsOfSpeech, word.pos, word.posDetail),
    word.level,
    word.plural ? labels.plural.replace('{plural}', word.plural) : null,
  ].filter(Boolean)
  const morphemes = word.segments.flatMap((segment) =>
    segment.morpheme ? [{ surface: segment.surface, morpheme: segment.morpheme }] : [],
  )

  return (
    <article className="space-y-4">
      <WordViewTracker language={language} wordId={word.id} />
      {/* Stays at the top while the rest scrolls, so the word and close button remain in view. */}
      <header className="sticky top-0 z-10 -mx-4 -mt-3 border-b border-[var(--line)] bg-[var(--card)] px-4 pt-3 pb-2">
        <div className="flex items-center gap-0.5">
          <h2 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight text-[var(--ink)]">
            <MorphemeText
              segments={word.segments}
              fallback={word.lemma}
              typeLabels={labels.morphemeTypes}
            />
          </h2>
          <AudioButton
            url={word.audioUrl}
            label={labels.playWord.replace('{word}', word.lemma)}
            slowLabel={labels.slowAudio}
          />
          <FavoriteButton
            initialFavorited={word.favorited}
            language={language}
            wordId={word.id}
            small
          />
          {actions}
        </div>
        <p className="mt-0.5 text-xs text-[var(--mute)]">{meta.join(' · ')}</p>
      </header>

      <section>
        <h3 className={sectionLabelClass}>{labels.meaning}</h3>
        <ol className="list-decimal space-y-0.5 pl-4 text-sm leading-5 text-[var(--ink)] marker:text-[var(--mute)]">
          {word.glosses.map((gloss) => (
            <li key={gloss}>{gloss}</li>
          ))}
        </ol>
      </section>

      {morphemes.length > 0 ? (
        <section>
          <h3 className={sectionLabelClass}>{labels.structure}</h3>
          <ul className="space-y-1 text-sm">
            {morphemes.map(({ surface, morpheme }, index) => (
              <li className="flex items-baseline gap-2" key={`${index}-${surface}`}>
                <span
                  className={`shrink-0 font-semibold ${morphemeColors[morpheme.type] ?? 'text-[var(--ink)]'}`}
                  title={labels.morphemeTypes[morpheme.type] ?? morpheme.type}
                >
                  {surface}
                </span>
                <span className="min-w-0 text-[var(--mute)]">{morpheme.meaning}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className={sectionLabelClass}>{labels.examples}</h3>
        {word.examples.length > 0 ? (
          <ul className="-mx-2">
            {word.examples.map((example) => (
              <li key={example.id}>
                <ExampleLine
                  example={example}
                  targetWordId={word.id}
                  playLabel={labels.playExample}
                  slowLabel={labels.slowAudio}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--mute)]">{labels.noExamples}</p>
        )}
      </section>

      <section>
        <h3 className={sectionLabelClass}>{labels.wordFamily}</h3>
        {word.relatedWords.length > 0 ? (
          <ul className="divide-y divide-[var(--line)]">
            {word.relatedWords.map((related) => (
              <li className="py-2 first:pt-0 last:pb-0" key={related.id}>
                <div className="flex items-baseline gap-1.5">
                  <Link
                    className="font-semibold text-[var(--ink)] hover:text-[var(--root)] hover:underline"
                    href={getWordPanelPath(language, related.slug, related.level)}
                    onClick={(event) => openWordPanelOnClick(event, related.slug)}
                  >
                    {related.lemma}
                  </Link>
                  <span className="truncate text-xs text-[var(--mute)]">
                    {[
                      formatPartOfSpeech(labels.partsOfSpeech, related.pos, related.posDetail),
                      related.level,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                {related.glosses.length > 0 ? (
                  <p className="text-sm leading-5 text-[var(--ink)]">
                    {related.glosses.join(', ')}
                  </p>
                ) : null}
                {related.example ? (
                  <div className="-mx-2 mt-0.5">
                    <ExampleLine
                      example={related.example}
                      targetWordId={related.id}
                      playLabel={labels.playExample}
                      slowLabel={labels.slowAudio}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--mute)]">{labels.noRelatedWords}</p>
        )}
      </section>
    </article>
  )
}

interface WordDetailPanelProps {
  language: string
  slug: string
  labels: WordPanelLabels
  onClose: () => void
}

interface PanelState {
  slug: string
  word: WordDetail | null
  error: boolean
}

export function WordDetailPanel({ language, slug, labels, onClose }: WordDetailPanelProps) {
  const [state, setState] = useState<PanelState>({ slug: '', word: null, error: false })
  const [retryVersion, setRetryVersion] = useState(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const isLoading = state.slug !== slug

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ lang: language, explain: 'en' })

    void fetchApiData<WordDetail>(`/api/v1/words/${encodeURIComponent(slug)}?${params}`, {
      signal: controller.signal,
    })
      .then((word) => setState({ slug, word, error: false }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        setState({ slug, word: null, error: true })
      })

    return () => controller.abort()
  }, [language, slug, retryVersion])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [slug])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const word = isLoading ? null : state.word
  const slot = useSyncExternalStore(subscribeToNothing, getPanelSlot, () => null)
  const closeButton = (
    <button
      aria-label={labels.close}
      className={iconButtonClass}
      title={labels.close}
      type="button"
      onClick={onClose}
    >
      <svg aria-hidden="true" className="size-4" {...strokeIcon}>
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  )

  const panel = (
    <>
      {/* On phones the panel covers the page, so give it a backdrop. On wide screens it is a
          column beside the list, which stays usable so another row can be picked. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/30 md:hidden"
        onClick={onClose}
      />
      <aside
        aria-busy={isLoading}
        aria-label={word?.lemma ?? labels.loading}
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[var(--line)] bg-[var(--card)] shadow-2xl md:sticky md:top-0 md:z-auto md:h-dvh md:w-[20rem] md:shrink-0 md:shadow-none lg:w-[22rem] xl:w-[24rem]"
      >
        {word ? null : (
          <div className="flex h-12 shrink-0 items-center justify-end border-b border-[var(--line)] px-2">
            {closeButton}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4" ref={bodyRef}>
          {word ? (
            <PanelWord actions={closeButton} language={language} labels={labels} word={word} />
          ) : !isLoading && state.error ? (
            <div className="py-12 text-center">
              <p className="text-[var(--mute)]">{labels.loadError}</p>
              <button
                className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:border-[var(--info)]"
                type="button"
                onClick={() => {
                  setState((current) => ({ ...current, slug: '' }))
                  setRetryVersion((version) => version + 1)
                }}
              >
                {labels.retry}
              </button>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-[var(--mute)]" role="status">
              {labels.loading}
            </p>
          )}
        </div>
      </aside>
    </>
  )

  // Outside the app shell (no slot) the panel still works as an overlay where it is rendered.
  return slot ? createPortal(panel, slot) : panel
}
