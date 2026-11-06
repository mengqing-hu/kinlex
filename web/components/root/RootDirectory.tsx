'use client'

import { type MouseEvent, useCallback, useState } from 'react'

import { FilterSelect } from '@/components/list/FilterSelect'
import { SortSelect, type SortSelectLabels } from '@/components/list/SortSelect'
import { ViewToggle, type ViewToggleLabels, type WordListView } from '@/components/list/ViewToggle'
import {
  MorphemeDetailPanel,
  type MorphemePanelLabels,
} from '@/components/root/MorphemeDetailPanel'
import { WordDetailPanel, type WordPanelLabels } from '@/components/word/WordDetailPanel'
import { Link } from '@/i18n/navigation'
import {
  updateSearchParameter,
  updateSearchParameters,
  useSearchParamsString,
} from '@/lib/client/searchParams'
import type { SortOrder } from '@/lib/constants'
import type { MorphemeDirectoryItem } from '@/types/domain'

export interface RootDirectoryLabels {
  allTypes: string
  empty: string
  noMatches: string
  search: string
  searchPlaceholder: string
  morphemePanel: MorphemePanelLabels
  type: string
  sorting: SortSelectLabels<RootSort>
  types: Record<string, string>
  views: ViewToggleLabels
  word: string
  wordPanel: WordPanelLabels
  words: string
}

interface RootDirectoryProps {
  items: readonly MorphemeDirectoryItem[]
  labels: RootDirectoryLabels
  language: string
}

const morphemeTypes = ['prefix', 'root', 'suffix'] as const

const rootSorts = ['alphabetical', 'words'] as const
export type RootSort = (typeof rootSorts)[number]
const defaultRootSortOrders: Record<RootSort, SortOrder> = { alphabetical: 'asc', words: 'desc' }

// Ignores the hyphens that mark prefixes and suffixes, so "-ung" sorts under u.
function compareText(left: MorphemeDirectoryItem, right: MorphemeDirectoryItem): number {
  return left.text.replaceAll('-', '').localeCompare(right.text.replaceAll('-', ''), 'de')
}

// Lower case, without the hyphens that mark prefixes and suffixes and without accents, so "über-"
// is found by "über", "uber" and, written the German way without umlauts, "ueber".
function searchKey(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('-', '').trim()
}

function withoutUmlautSpelling(key: string): string {
  return key.replaceAll('ae', 'a').replaceAll('oe', 'o').replaceAll('ue', 'u')
}

// Only the word part itself, not its meaning.
function matchesSearch(item: MorphemeDirectoryItem, key: string): boolean {
  const text = searchKey(item.text)
  return text.includes(key) || text.includes(withoutUmlautSpelling(key))
}

export function RootDirectory({ items, labels, language }: RootDirectoryProps) {
  const [selectedType, setSelectedType] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<WordListView>('cards')
  // Null until the reader picks a sort; the list is then in its default order, A to Z.
  const [chosenSort, setChosenSort] = useState<RootSort | null>(null)
  const [order, setOrder] = useState<SortOrder>(defaultRootSortOrders.alphabetical)
  const sort: RootSort = chosenSort ?? 'alphabetical'
  const wordCount = (count: number) => `${count} ${count === 1 ? labels.word : labels.words}`
  // The word part open in the side panel, and a word opened from it, kept in the URL like the
  // word list's open word, so Back closes them and they can be shared.
  const search = new URLSearchParams(useSearchParamsString())
  const openSlug = search.get('root') ?? ''
  const openWord = search.get('word') ?? ''
  const openItem = items.find((item) => item.slug === openSlug)
  const closeMorphemePanel = useCallback(() => updateSearchParameter('root', ''), [])
  const closeWordPanel = useCallback(() => updateSearchParameter('word', ''), [])

  // A plain click opens the word part beside the list; a modified or middle click keeps the
  // link's own behaviour, its page in a new tab.
  function openOnClick(event: MouseEvent, slug: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    event.preventDefault()
    updateSearchParameters({ root: slug, word: '' })
  }
  const direction = order === 'asc' ? 1 : -1
  const key = searchKey(searchQuery)
  const shownItems = items
    .filter((item) => !selectedType || item.type === selectedType)
    .filter((item) => !key || matchesSearch(item, key))
    .toSorted((left, right) =>
      sort === 'words'
        ? direction * (left.wordCount - right.wordCount) || compareText(left, right)
        : direction * compareText(left, right),
    )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label={labels.type}
            options={[
              { value: '', label: labels.allTypes, count: items.length },
              ...morphemeTypes.map((type) => ({
                value: type,
                label: labels.types[type] ?? type,
                count: items.filter((item) => item.type === type).length,
              })),
            ]}
            value={selectedType}
            onChange={setSelectedType}
          />
          <SortSelect
            defaultOrders={defaultRootSortOrders}
            defaultSort="alphabetical"
            labels={labels.sorting}
            order={order}
            sort={chosenSort}
            sorts={rootSorts}
            onChange={(nextSort, nextOrder) => {
              setChosenSort(nextSort)
              setOrder(nextOrder)
            }}
          />
          <label className="relative w-full sm:w-auto sm:max-w-64 sm:min-w-40 sm:flex-1">
            <span className="sr-only">{labels.search}</span>
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--mute)]"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--card)] pr-3.5 pl-9 text-sm text-[var(--ink)] transition-colors placeholder:text-[var(--mute)] hover:border-[var(--mute)] focus-visible:border-[var(--mute)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
              maxLength={100}
              placeholder={labels.searchPlaceholder}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
        </div>
        <ViewToggle labels={labels.views} view={view} onChange={setView} />
      </div>

      {shownItems.length > 0 ? (
        <div className="mt-8 space-y-12">
          {morphemeTypes.map((type) => {
            const typeItems = shownItems.filter((item) => item.type === type)
            if (typeItems.length === 0) return null

            return (
              <section aria-labelledby={`${type}-heading`} key={type}>
                <h2 className="text-2xl font-semibold text-[var(--ink)]" id={`${type}-heading`}>
                  {labels.types[type] ?? type}
                </h2>
                {view === 'cards' ? (
                  // Like the word list's cards, two columns while the side panel takes room.
                  <ul
                    className={`mt-4 grid gap-3 sm:grid-cols-2 ${openItem || openWord ? '2xl:grid-cols-3' : 'lg:grid-cols-3'}`}
                  >
                    {typeItems.map((item) => (
                      <li className="flex" key={item.id}>
                        <Link
                          aria-current={item.slug === openSlug ? 'true' : undefined}
                          className={`flex w-full flex-col rounded-xl border bg-[var(--card)] p-4 hover:border-[var(--root)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none ${item.slug === openSlug ? 'border-[var(--root)]' : 'border-[var(--line)]'}`}
                          href={`/${language}/word-parts/${item.slug}`}
                          onClick={(event) => openOnClick(event, item.slug)}
                          prefetch={false}
                        >
                          <span className="text-lg font-semibold text-[var(--ink)]">
                            {item.text}
                          </span>
                          {/* Always two lines tall, so every card has the same size. */}
                          <span
                            className="mt-1 line-clamp-2 min-h-10 text-sm text-[var(--mute)]"
                            title={item.meaning}
                          >
                            {item.meaning}
                          </span>
                          <span className="mt-4 block text-xs font-semibold tracking-wide text-[var(--mute)] uppercase">
                            {wordCount(item.wordCount)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="mt-3">
                    {typeItems.map((item) => (
                      <li className="border-b border-[var(--line)] last:border-b-0" key={item.id}>
                        <Link
                          aria-current={item.slug === openSlug ? 'true' : undefined}
                          className={`grid min-h-9 grid-cols-[8rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-md px-2 py-1 transition-colors hover:bg-[var(--row-hover)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none ${item.slug === openSlug ? 'bg-[var(--row-hover)]' : ''}`}
                          href={`/${language}/word-parts/${item.slug}`}
                          onClick={(event) => openOnClick(event, item.slug)}
                          prefetch={false}
                        >
                          <span className="truncate text-sm font-semibold text-[var(--ink)]">
                            {item.text}
                          </span>
                          <span className="truncate text-sm text-[var(--mute)]">
                            {item.meaning}
                          </span>
                          <span className="text-xs text-[var(--mute)] tabular-nums">
                            {wordCount(item.wordCount)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      ) : (
        <p className="mt-8 text-[var(--mute)]">{key ? labels.noMatches : labels.empty}</p>
      )}

      {/* A word opened from the word part's list takes the panel's place; closing it goes back. */}
      {openWord ? (
        <WordDetailPanel
          labels={labels.wordPanel}
          language={language}
          slug={openWord}
          onClose={closeWordPanel}
        />
      ) : openItem ? (
        <MorphemeDetailPanel
          labels={labels.morphemePanel}
          language={language}
          morpheme={openItem}
          wordCount={wordCount(openItem.wordCount)}
          onClose={closeMorphemePanel}
        />
      ) : null}
    </div>
  )
}
