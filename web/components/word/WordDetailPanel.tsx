'use client'

import { useLocale } from 'next-intl'
import { type ReactNode, useEffect, useRef, useState } from 'react'

import { WordViewTracker } from '@/components/activity/WordViewTracker'
import { AudioButton } from '@/components/audio/AudioButton'
import { FavoriteButton } from '@/components/favorite/FavoriteButton'
import { PanelCloseButton, panelSectionLabelClass, SidePanel } from '@/components/ui/SidePanel'
import { ExampleLine } from '@/components/word/ExampleLine'
import { MorphemeText } from '@/components/word/MorphemeText'
import { Link } from '@/i18n/navigation'
import { fetchApiData } from '@/lib/client/apiClient'
import { formatPartOfSpeech } from '@/lib/utils/partOfSpeech'
import { openWordPanelOnClick } from '@/lib/client/searchParams'
import { getWordPanelPath } from '@/lib/wordPanel'
import type { WordDetail } from '@/types/domain'

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

const morphemeColors: Record<string, string> = {
  prefix: 'text-[var(--prefix)]',
  root: 'text-[var(--root)]',
  suffix: 'text-[var(--suffix)]',
}

// A denser layout than the full word page: one header row, small section labels instead of
// headings and dividers, and inline lists instead of cards, so the narrow column reads at a glance.
function PanelWord({
  actions,
  context,
  language,
  labels,
  word,
}: {
  actions: ReactNode
  context: ReactNode
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
    <article className="space-y-6">
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
            size="sm"
          />
          {actions}
        </div>
        <p className="mt-0.5 text-xs text-[var(--mute)]">{meta.join(' · ')}</p>
      </header>

      {context}

      <section>
        <h3 className={panelSectionLabelClass}>{labels.meaning}</h3>
        <ol className="list-decimal space-y-1 rounded-xl border border-[var(--line)] bg-[var(--bg)]/60 py-2.5 pr-3 pl-8 text-sm leading-5 text-[var(--ink)] marker:font-semibold marker:text-[var(--mute)]">
          {word.glosses.map((gloss) => (
            <li key={gloss}>{gloss}</li>
          ))}
        </ol>
      </section>

      {morphemes.length > 0 ? (
        <section>
          <h3 className={panelSectionLabelClass}>{labels.structure}</h3>
          <ul className="space-y-1 rounded-xl border border-[var(--line)] bg-[var(--bg)]/60 p-3 text-sm">
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
        <h3 className={panelSectionLabelClass}>{labels.examples}</h3>
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
        <h3 className={panelSectionLabelClass}>{labels.wordFamily}</h3>
        {word.relatedWords.length > 0 ? (
          <ul className="space-y-1.5">
            {word.relatedWords.map((related) => (
              <li
                className="rounded-xl px-2 py-2.5 transition-colors odd:bg-[var(--bg)]/70 hover:bg-[var(--row-hover)]"
                key={related.id}
              >
                <div className="flex items-baseline gap-1.5">
                  <Link
                    className="font-semibold text-[var(--ink)] hover:text-[var(--root)] hover:underline"
                    href={getWordPanelPath(language, related.slug, related.level)}
                    onClick={(event) => openWordPanelOnClick(event, related.slug)}
                    prefetch={false}
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
  // Shown under the word's header, such as the sentence the word was picked from.
  context?: ReactNode
  // Defaults to the interface language.
  explainLanguage?: string
  // Shown above the word and kept in view, such as a search box.
  header?: ReactNode
  persistent?: boolean
}

interface PanelState {
  slug: string
  word: WordDetail | null
  error: boolean
}

export function WordDetailPanel({
  language,
  slug,
  labels,
  onClose,
  context,
  explainLanguage: explainLanguageProp,
  header,
  persistent,
}: WordDetailPanelProps) {
  const locale = useLocale()
  const explainLanguage = explainLanguageProp ?? locale
  const [state, setState] = useState<PanelState>({ slug: '', word: null, error: false })
  const [retryVersion, setRetryVersion] = useState(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const isLoading = state.slug !== slug

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ lang: language, explain: explainLanguage })

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
  }, [language, explainLanguage, slug, retryVersion])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [slug])

  const word = isLoading ? null : state.word
  const closeButton = <PanelCloseButton label={labels.close} onClose={onClose} />

  return (
    <SidePanel
      busy={isLoading}
      label={word?.lemma ?? labels.loading}
      persistent={persistent}
      onClose={onClose}
    >
      {header}
      {word ? null : (
        <div className="flex h-12 shrink-0 items-center justify-end border-b border-[var(--line)] px-2">
          {closeButton}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4" ref={bodyRef}>
        {word ? (
          <PanelWord
            actions={closeButton}
            context={context}
            language={language}
            labels={labels}
            word={word}
          />
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
    </SidePanel>
  )
}
