'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { FilterBar } from '@/components/list/FilterBar'
import { hiddenSides, type ListOptionsLabels } from '@/components/list/ListOptions'
import type { SortSelectLabels } from '@/components/list/SortSelect'
import { type ViewToggleLabels, wordListViews } from '@/components/list/ViewToggle'
import { normalizePartOfSpeech } from '@/lib/utils/partOfSpeech'
import type { MorphemeCardLabels } from '@/components/word/MorphemeCard'
import { WordDetailPanel, type WordPanelLabels } from '@/components/word/WordDetailPanel'
import { WordCard } from '@/components/word/WordCard'
import { WordRow } from '@/components/word/WordRow'
import { fetchApiData } from '@/lib/client/apiClient'
import {
  SEARCH_PARAMS_CHANGE_EVENT,
  updateSearchParameter,
  updateSearchParameters,
} from '@/lib/client/searchParams'
import {
  findMarkedWordIds,
  resetWordState,
  type ResettableWordState,
} from '@/lib/client/wordStateReset'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import {
  defaultSortOrders,
  personalWordSorts,
  sortOrders,
  type SortOrder,
  type WordSort,
  wordLevels,
  wordSorts,
} from '@/lib/constants'
import type { CursorPage, WordFilterOption, WordFilterOptions, WordListItem } from '@/types/domain'

const PAGE_SIZE = 20
const MIN_SCROLL_AREA_HEIGHT = 320

export interface WordListLabels {
  allLevels: string
  level: string
  allPartsOfSpeech: string
  partOfSpeech: string
  allTopics: string
  topic: string
  otherTopic: string
  otherTopicHint: string
  searchWords: string
  searchPlaceholder: string
  sorting: SortSelectLabels
  listOptions: ListOptionsLabels
  views: ViewToggleLabels
  loadMore: string
  loading: string
  empty: string
  loadError: string
  retry: string
  playWord: string
  playExample: string
  slowAudio: string
  familiarity: string
  openWord: string
  morphemeTypes: Record<string, string>
  partsOfSpeech: Record<string, string>
  morphemeCard: Omit<MorphemeCardLabels, 'morphemeTypes' | 'partsOfSpeech'>
  wordPanel: WordPanelLabels
}

interface WordListProps {
  language: string
  level?: string
  morpheme?: string
  topic?: string
  favoritesOnly?: boolean
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
  window.addEventListener(SEARCH_PARAMS_CHANGE_EVENT, callback)

  return () => {
    window.removeEventListener('popstate', callback)
    window.removeEventListener(SEARCH_PARAMS_CHANGE_EVENT, callback)
  }
}

function getSearchParamsSnapshot(): string {
  return window.location.search
}

function getServerSearchParamsSnapshot(): string {
  return ''
}

// The filters of a word list, as the words API takes them.
function listFilterParams(
  language: string,
  level: string | undefined,
  query: string,
  partOfSpeech: string,
  topic: string,
  morpheme: string | undefined,
  favoritesOnly: boolean,
): URLSearchParams {
  const params = new URLSearchParams({ lang: language })

  if (favoritesOnly) {
    params.set('favorites', '1')
  }

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

  return params
}

async function fetchWordPage(
  language: string,
  level: string | undefined,
  query: string,
  partOfSpeech: string,
  topic: string,
  morpheme: string | undefined,
  sort: WordSort,
  order: SortOrder,
  favoritesOnly: boolean,
  cursor?: string,
  signal?: AbortSignal,
): Promise<CursorPage<WordListItem>> {
  const params = listFilterParams(
    language,
    level,
    query,
    partOfSpeech,
    topic,
    morpheme,
    favoritesOnly,
  )
  params.set('limit', String(PAGE_SIZE))

  if (sort !== 'frequency' || order !== defaultSortOrders.frequency) {
    params.set('sort', sort)
    params.set('order', order)
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
  favoritesOnly = false,
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
      hidden: hiddenSides.find((side) => side === params.get('hide')) ?? null,
      hideActions: params.get('actions') === '0',
      view: wordListViews.find((option) => option === params.get('view')) ?? 'list',
      // The word open in the side panel, kept in the URL so Back closes it and it can be shared.
      openWord: params.get('word') ?? '',
      sort: wordSorts.find((option) => option === params.get('sort')) ?? 'frequency',
      order: sortOrders.find((option) => option === params.get('order')),
    }
  }, [search, showTopicFilter, topic])
  const [state, setState] = useState<WordListState>({
    ...initialPage,
    queryKey: `::${topic ?? ''}:${morpheme ?? ''}`,
    error: false,
  })
  const [retryVersion, setRetryVersion] = useState(0)
  // Raised after a reset, so the list loads again and its words show their new state.
  const [dataVersion, setDataVersion] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<() => Promise<void>>(async () => undefined)
  const [scrollAreaHeight, setScrollAreaHeight] = useState<number | null>(null)
  // Sorts by what one learner did need an account, so guests get the default order instead.
  const sortAllowed = signedIn || !personalWordSorts.includes(filters.sort)
  const sort: WordSort = sortAllowed ? filters.sort : 'frequency'
  const order: SortOrder = (sortAllowed ? filters.order : undefined) ?? defaultSortOrders[sort]
  const queryKey = `${debouncedSearchQuery}:${filters.partOfSpeech}:${filters.topic}:${morpheme ?? ''}:${sort}:${order}:${dataVersion}`

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
      order,
      favoritesOnly,
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
    favoritesOnly,
    filters.partOfSpeech,
    filters.topic,
    language,
    level,
    morpheme,
    order,
    queryKey,
    retryVersion,
    sort,
    state.queryKey,
  ])

  const isRefreshing = state.queryKey !== queryKey

  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) {
      return
    }

    // Size the word area so the whole page, including what sits below the list (the page's bottom
    // padding and a footer, if the page has one), fits in the window. The page then has nothing to scroll, so the
    // filter bar never slides under the sticky navigation. Positions are measured against the
    // page, so the result is the same however far the page has been scrolled.
    function measure() {
      if (!scrollArea) {
        return
      }
      const areaRect = scrollArea.getBoundingClientRect()
      const mainRect = scrollArea.closest('main')?.getBoundingClientRect()
      const footerHeight = document.querySelector('footer')?.getBoundingClientRect().height ?? 0
      const top = areaRect.top + window.scrollY
      const below = (mainRect ? mainRect.bottom - areaRect.bottom : 0) + footerHeight
      setScrollAreaHeight(Math.max(MIN_SCROLL_AREA_HEIGHT, window.innerHeight - top - below))
    }

    measure()
    window.addEventListener('resize', measure)
    // The filter bar above can wrap onto more lines, which moves the word area down.
    const observer = new ResizeObserver(measure)
    if (scrollArea.previousElementSibling) {
      observer.observe(scrollArea.previousElementSibling)
    }

    return () => {
      window.removeEventListener('resize', measure)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    // A new filter result starts from the top of the word area, not where the old list was.
    scrollAreaRef.current?.scrollTo({ top: 0 })
  }, [state.queryKey])
  const closeWordPanel = useCallback(() => updateSearchParameter('word', ''), [])

  // What a word needs to show as a row or a card.
  const itemProps = (word: WordListItem) => ({
    language,
    word,
    hideWord: filters.hidden === 'word',
    hideMeanings: filters.hidden === 'meaning',
    hideActions: filters.hideActions,
    selected: filters.openWord === word.slug,
    labels: {
      playWord: labels.playWord.replace('{word}', word.lemma),
      playExample: labels.playExample,
      slowAudio: labels.slowAudio,
      familiarity: labels.familiarity,
      openWord: labels.openWord.replace('{word}', word.lemma),
    },
    morphemeTypeLabels: labels.morphemeTypes,
    morphemeCardLabels: {
      ...labels.morphemeCard,
      morphemeTypes: labels.morphemeTypes,
      partsOfSpeech: labels.partsOfSpeech,
    },
    onOpen: () => updateSearchParameter('word', word.slug),
  })

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
        order,
        favoritesOnly,
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

  useEffect(() => {
    loadMoreRef.current = loadMore
  })

  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    const sentinel = loadMoreSentinelRef.current
    if (!scrollArea || !sentinel || !state.nextCursor || state.error) {
      return
    }

    // Load the next page as the end of the list scrolls into view. The observer is recreated after
    // every page, so it fires again straight away while the list is still too short to scroll.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void loadMoreRef.current()
        }
      },
      { root: scrollArea, rootMargin: '0px 0px 300px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [state.nextCursor, state.error])

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
        hidden={filters.hidden}
        hideActions={filters.hideActions}
        selectedSort={sort}
        selectedOrder={order}
        canUsePersonalSorts={signedIn}
        view={filters.view}
        labels={labels}
        onLevelChange={(value) => {
          router.push(
            `/${encodeURIComponent(language)}/levels/${value ? value.toLowerCase() : 'all'}`,
          )
        }}
        onSearchQueryChange={setSearchQuery}
        onPartOfSpeechChange={(value) => updateSearchParameter('pos', value)}
        onTopicChange={(value) => updateSearchParameter('topic', value)}
        onSortChange={(nextSort, nextOrder) =>
          updateSearchParameters(
            // The default order keeps the URL clean.
            nextSort === 'frequency' && nextOrder === defaultSortOrders.frequency
              ? { sort: '', order: '' }
              : { sort: nextSort, order: nextOrder },
          )
        }
        // The list is the default, so it leaves the URL clean.
        onViewChange={(view) => updateSearchParameter('view', view === 'list' ? '' : view)}
        onHiddenChange={(hidden) => updateSearchParameter('hide', hidden ?? '')}
        onHideActionsChange={(checked) => updateSearchParameter('actions', checked ? '0' : '')}
        loadMarkedWordIds={() =>
          findMarkedWordIds(
            listFilterParams(
              language,
              level,
              debouncedSearchQuery,
              filters.partOfSpeech,
              filters.topic,
              morpheme,
              favoritesOnly,
            ),
            signedIn,
          )
        }
        onReset={async (field: ResettableWordState, wordIds: number[]) => {
          const changed = await resetWordState(field, wordIds, signedIn)
          if (changed.length > 0) setDataVersion((version) => version + 1)
          return changed.length
        }}
      />

      <div
        className="max-h-[calc(100dvh-12rem)] overflow-y-auto overscroll-contain"
        ref={scrollAreaRef}
        style={scrollAreaHeight === null ? undefined : { maxHeight: scrollAreaHeight }}
      >
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
            filters.view === 'cards' ? (
              <ul
                className={`grid gap-4 p-1 sm:grid-cols-2 ${filters.openWord ? '2xl:grid-cols-3' : 'xl:grid-cols-3'}`}
              >
                {state.items.map((word) => (
                  <WordCard key={`${dataVersion}:${word.id}`} {...itemProps(word)} />
                ))}
              </ul>
            ) : (
              <div className="overflow-x-auto">
                <ul className={filters.openWord ? 'min-w-sm' : 'min-w-5xl'}>
                  {state.items.map((word) => (
                    <WordRow
                      key={`${dataVersion}:${word.id}`}
                      {...itemProps(word)}
                      compact={Boolean(filters.openWord)}
                    />
                  ))}
                </ul>
              </div>
            )
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
          <div className="py-4 text-center text-sm text-[var(--mute)]" ref={loadMoreSentinelRef}>
            {isLoadingMore ? <span role="status">{labels.loading}</span> : null}
          </div>
        ) : null}
      </div>

      {filters.openWord ? (
        <WordDetailPanel
          labels={labels.wordPanel}
          language={language}
          slug={filters.openWord}
          onClose={closeWordPanel}
        />
      ) : null}
    </div>
  )
}
