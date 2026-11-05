import { FilterSelect } from '@/components/list/FilterSelect'
import { type HiddenSide, ListOptions, type ListOptionsLabels } from '@/components/list/ListOptions'
import { SortSelect, type SortSelectLabels } from '@/components/list/SortSelect'
import { ViewToggle, type ViewToggleLabels, type WordListView } from '@/components/list/ViewToggle'
import type { MarkedWordIds, ResettableWordState } from '@/lib/client/wordStateReset'
import {
  defaultSortOrders,
  OTHER_TOPIC,
  personalWordSorts,
  type SortOrder,
  type WordSort,
  wordSorts,
} from '@/lib/constants'
import type { WordFilterCounts, WordFilterOption } from '@/types/domain'

interface FilterBarLabels {
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
}

interface FilterBarProps {
  counts: WordFilterCounts
  levels?: WordFilterOption[]
  partsOfSpeech: WordFilterOption[]
  topics: WordFilterOption[]
  showLevelFilter?: boolean
  selectedLevel?: string
  searchQuery: string
  selectedPartOfSpeech: string
  selectedTopic: string
  hidden: HiddenSide | null
  hideActions: boolean
  selectedSort: WordSort
  selectedOrder: SortOrder
  canUsePersonalSorts: boolean
  view: WordListView
  labels: FilterBarLabels
  onLevelChange?: (value: string) => void
  onSearchQueryChange: (value: string) => void
  onPartOfSpeechChange: (value: string) => void
  onTopicChange: (value: string) => void
  onSortChange: (sort: WordSort, order: SortOrder) => void
  onViewChange: (view: WordListView) => void
  onHiddenChange: (hidden: HiddenSide | null) => void
  onHideActionsChange: (checked: boolean) => void
  loadMarkedWordIds: () => Promise<MarkedWordIds>
  onReset: (field: ResettableWordState, wordIds: number[]) => Promise<number>
}

export function FilterBar({
  counts,
  levels = [],
  partsOfSpeech,
  topics,
  showLevelFilter = false,
  selectedLevel = '',
  searchQuery,
  selectedPartOfSpeech,
  selectedTopic,
  hidden,
  hideActions,
  selectedSort,
  selectedOrder,
  canUsePersonalSorts,
  view,
  labels,
  onLevelChange,
  onSearchQueryChange,
  onPartOfSpeechChange,
  onTopicChange,
  onSortChange,
  onViewChange,
  onHiddenChange,
  onHideActionsChange,
  loadMarkedWordIds,
  onReset,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 border-y border-[var(--line)] py-4 lg:flex-row lg:items-center">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {showLevelFilter && onLevelChange ? (
          <FilterSelect
            label={labels.level}
            options={[{ value: '', label: labels.allLevels, count: counts.allLevels }, ...levels]}
            value={selectedLevel}
            onChange={onLevelChange}
          />
        ) : null}
        <FilterSelect
          label={labels.partOfSpeech}
          options={[
            { value: '', label: labels.allPartsOfSpeech, count: counts.total },
            ...partsOfSpeech,
          ]}
          value={selectedPartOfSpeech}
          onChange={onPartOfSpeechChange}
        />
        {/* Hidden until words have been sorted into topics, unless a link already chose one. */}
        {topics.length > 0 || selectedTopic ? (
          <FilterSelect
            label={labels.topic}
            options={[
              { value: '', label: labels.allTopics, count: counts.total },
              ...topics,
              {
                value: OTHER_TOPIC,
                label: labels.otherTopic,
                hint: labels.otherTopicHint,
                count: counts.topics[OTHER_TOPIC] ?? 0,
                separated: true,
              },
            ]}
            value={selectedTopic}
            onChange={onTopicChange}
          />
        ) : null}
        <SortSelect
          defaultOrders={defaultSortOrders}
          defaultSort="frequency"
          disabledSorts={canUsePersonalSorts ? [] : personalWordSorts}
          labels={labels.sorting}
          sorts={wordSorts}
          order={selectedOrder}
          sort={selectedSort}
          onChange={onSortChange}
        />
        <label className="relative w-full sm:w-auto sm:max-w-64 sm:min-w-40 sm:flex-1">
          <span className="sr-only">{labels.searchWords}</span>
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
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ViewToggle labels={labels.views} view={view} onChange={onViewChange} />
        <ListOptions
          hidden={hidden}
          hideActions={hideActions}
          labels={labels.listOptions}
          loadMarkedWordIds={loadMarkedWordIds}
          onReset={onReset}
          onHiddenChange={onHiddenChange}
          onHideActionsChange={onHideActionsChange}
        />
      </div>
    </div>
  )
}
