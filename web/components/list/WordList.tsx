'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import { FilterBar } from '@/components/list/FilterBar'
import { normalizePartOfSpeech } from '@/lib/utils/partOfSpeech'
import type { MorphemeCardLabels } from '@/components/word/MorphemeCard'
import { WordRow } from '@/components/word/WordRow'
import { fetchApiData } from '@/lib/client/apiClient'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { wordLevels, wordSorts } from '@/lib/validation/words'
import type { CursorPage, WordFilterOption, WordFilterOptions, WordListItem } from '@/types/domain'

const FILTER_CHANGE_EVENT = 'kinlex:filters'
const PAGE_SIZE = 20

export interface WordListLabels {
  allLevels: string
  level: string
  allPartsOfSpeech: string
  partOfSpeech: string
  allTopics: string
  topic: string
  searchWords: string
  searchPlaceholder: string
  hideMeanings: string
  showMeanings: string
  sort: string
  sortDefault: string
  sortFamiliarityAsc: string
  sortFamiliarityDesc: string
  sortSignInHint: string
  hideActions: string
  showActions: string
  loadMore: string
  loading: string
  empty: string
  loadError: string
  retry: string
  playWord: string
  playExample: string
  slowAudio: string
  hideWord: string
  showWord: string
  familiarity: string
  openWord: string
  morphemeTypes: Record<string, string>
  partsOfSpeech: Record<string, string>
  morphemeCard: Omit<MorphemeCardLabels, 'morphemeTypes' | 'partsOfSpeech'>
}

interface WordListProps {
  language: string
  level?: string
  morpheme?: string
  topic?: string
  showLevelFilter?: boolean
  showTopicFilter?: boolean
  initialPage: CursorPage<WordListItem>
  filterOptions: WordFilterOptions
  labels: WordListLabels
}

interface WordListState extends CursorPage<WordListItem> {
  queryKey: string
  error: boolean
}

function subscribeToSearchParams(callback: () => void): () => void {
  window.addEventListener('popstate', callback)
  window.addEventListener(FILTER_CHANGE_EVENT, callback)

  return () => {
    window.removeEventListener('popstate', callback)
    window.removeEventListener(FILTER_CHANGE_EVENT, callback)
  }
}

function getSearchParamsSnapshot(): string {
  return window.location.search
}

function getServerSearchParamsSnapshot(): string {
  return ''
}

function updateSearchParameter(name: string, value: string): void {
  const url = new URL(window.location.href)

  if (value) {
    url.searchParams.set(name, value)
  } else {
    url.searchParams.delete(name)
  }

  window.history.pushState(null, '', url)
  window.dispatchEvent(new Event(FILTER_CHANGE_EVENT))
}

async function fetchWordPage(
  language: string,
  level: string | undefined,
  query: string,
  partOfSpeech: string,
  topic: string,
  morpheme: string | undefined,
  sort: string,
  cursor?: string,
  signal?: AbortSignal,
): Promise<CursorPage<WordListItem>> {
  const params = new URLSearchParams({ lang: language, limit: String(PAGE_SIZE) })

  if (level) {
    params.set('level', level)
  }

  if (query) {
    params.set('q', query)
  }

  if (partOfSpeech) {
    params.set('pos', partOfSpeech)
  }

  if (topic) {
    params.set('topic', topic)
  }

  if (morpheme) {
    params.set('morpheme', morpheme)
  }

  if (sort) {
    params.set('sort', sort)
  }

  if (cursor) {
    params.set('cursor', cursor)
  }

  return fetchApiData<CursorPage<WordListItem>>(`/api/v1/words?${params}`, {
    cache: 'no-store',
    signal,
  })
}

export function WordList({
  language,
  level,
  morpheme,
  topic,
  showLevelFilter = false,
  showTopicFilter = true,
  initialPage,
  filterOptions,
  labels,
}: WordListProps) {
  const router = useRouter()
  const search = useSyncExternalStore(
    subscribeToSearchParams,
    getSearchParamsSnapshot,
    getServerSearchParamsSnapshot,
  )
  const filters = useMemo(() => {
    const params = new URLSearchParams(search)
    return {
      partOfSpeech: normalizePartOfSpeech(params.get('pos') ?? ''),
      topic: showTopicFilter ? (params.get('topic') ?? '') : (topic ?? ''),
      hideMeanings: params.get('hide') === '1',
      hideActions: params.get('actions') === '0',
      sort: (wordSorts as readonly string[]).includes(params.get('sort') ?? '')
        ? (params.get('sort') ?? '')
        : '',
    }
  }, [search, showTopicFilter, topic])
  const [state, setState] = useState<WordListState>({
    ...initialPage,
    queryKey: `::${topic ?? ''}:${morpheme ?? ''}`,
    error: false,
  })
  const [retryVersion, setRetryVersion] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hiddenWordIds, setHiddenWordIds] = useState<Set<number>>(() => new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  // Familiarity sorting needs an account, so guests always get the default order.
  const sort = signedIn ? filters.sort : ''
  const queryKey = `${debouncedSearchQuery}:${filters.partOfSpeech}:${filters.topic}:${morpheme ?? ''}:${sort}`

  useEffect(() => {
    void getBrowserSupabase()
      .auth.getSession()
      .then(({ data }) => setSignedIn(Boolean(data.session)))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (state.queryKey === queryKey) {
      return
    }

    const controller = new AbortController()

    void fetchWordPage(
      language,
      level,
      debouncedSearchQuery,
      filters.partOfSpeech,
      filters.topic,
      morpheme,
      sort,
      undefined,
      controller.signal,
    )
      .then((page) => {
        setState({ ...page, queryKey, error: false })
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        setState((current) => ({ ...current, queryKey, error: true }))
      })

    return () => controller.abort()
  }, [
    debouncedSearchQuery,
    filters.partOfSpeech,
    filters.topic,
    language,
    level,
    morpheme,
    queryKey,
    retryVersion,
    sort,
    state.queryKey,
  ])

  const isRefreshing = state.queryKey !== queryKey
  const partOfSpeechOptions: WordFilterOption[] = filterOptions.partsOfSpeech.map((value) => ({
    value,
    label: labels.partsOfSpeech[value] ?? value,
  }))
  async function loadMore() {
    if (!state.nextCursor || isLoadingMore || isRefreshing) {
      return
    }

    setIsLoadingMore(true)

    try {
      const page = await fetchWordPage(
        language,
        level,
        debouncedSearchQuery,
        filters.partOfSpeech,
        filters.topic,
        morpheme,
        sort,
        state.nextCursor,
      )
      setState((current) => ({
        ...current,
        items: [...current.items, ...page.items],
        nextCursor: page.nextCursor,
        error: false,
      }))
    } catch {
      setState((current) => ({ ...current, error: true }))
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <div>
      <FilterBar
        levels={wordLevels.map((value) => ({ value, label: value }))}
        partsOfSpeech={partOfSpeechOptions}
        topics={filterOptions.topics}
        showLevelFilter={showLevelFilter}
        showTopicFilter={showTopicFilter}
        selectedLevel={level ?? ''}
        searchQuery={searchQuery}
        selectedPartOfSpeech={filters.partOfSpeech}
        selectedTopic={filters.topic}
        hideMeanings={filters.hideMeanings}
        hideActions={filters.hideActions}
        selectedSort={sort}
        canSortByFamiliarity={signedIn}
        labels={labels}
        onLevelChange={(value) => {
          router.push(
            `/${encodeURIComponent(language)}/levels/${value ? value.toLowerCase() : 'all'}`,
          )
        }}
        onSearchQueryChange={setSearchQuery}
        onPartOfSpeechChange={(value) => updateSearchParameter('pos', value)}
        onTopicChange={(value) => updateSearchParameter('topic', value)}
        onSortChange={(value) => updateSearchParameter('sort', value)}
        onHideMeaningsChange={(checked) => updateSearchParameter('hide', checked ? '1' : '')}
        onHideActionsChange={(checked) => updateSearchParameter('actions', checked ? '0' : '')}
      />

      <div aria-busy={isRefreshing} className={isRefreshing ? 'opacity-50' : undefined}>
        {state.error ? (
          <div className="py-12 text-center">
            <p className="text-[var(--mute)]">{labels.loadError}</p>
            <button
              className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:border-[var(--info)]"
              type="button"
              onClick={() => {
                setState((current) => ({ ...current, queryKey: '' }))
                setRetryVersion((version) => version + 1)
              }}
            >
              {labels.retry}
            </button>
          </div>
        ) : state.items.length > 0 ? (
          <div className="overflow-x-auto">
            <ul className="min-w-5xl">
              {state.items.map((word) => (
                <WordRow
                  language={language}
                  word={word}
                  hideMeanings={filters.hideMeanings}
                  hideActions={filters.hideActions}
                  hidden={hiddenWordIds.has(word.id)}
                  key={word.id}
                  labels={{
                    playWord: labels.playWord.replace('{word}', word.lemma),
                    playExample: labels.playExample,
                    slowAudio: labels.slowAudio,
                    hideWord: labels.hideWord,
                    showWord: labels.showWord,
                    familiarity: labels.familiarity,
                  }}
                  morphemeTypeLabels={labels.morphemeTypes}
                  morphemeCardLabels={{
                    ...labels.morphemeCard,
                    morphemeTypes: labels.morphemeTypes,
                    partsOfSpeech: labels.partsOfSpeech,
                  }}
                  partOfSpeechLabels={labels.partsOfSpeech}
                  onToggleHidden={() => {
                    setHiddenWordIds((current) => {
                      const next = new Set(current)

                      if (next.has(word.id)) {
                        next.delete(word.id)
                      } else {
                        next.add(word.id)
                      }

                      return next
                    })
                  }}
                />
              ))}
            </ul>
          </div>
        ) : (
          <p className="py-12 text-center text-[var(--mute)]">{labels.empty}</p>
        )}
      </div>

      {isRefreshing ? (
        <p className="py-4 text-center text-sm text-[var(--mute)]" role="status">
          {labels.loading}
        </p>
      ) : null}

      {state.nextCursor && !state.error ? (
        <div className="pt-8 text-center">
          <button
            className="rounded-lg border border-[var(--line)] bg-[var(--card)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] hover:border-[var(--suffix)] disabled:cursor-wait disabled:opacity-60"
            disabled={isLoadingMore}
            type="button"
            onClick={() => void loadMore()}
          >
            {isLoadingMore ? labels.loading : labels.loadMore}
          </button>
        </div>
      ) : null}
    </div>
  )
}
