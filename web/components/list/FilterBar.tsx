import { FilterSelect } from '@/components/list/FilterSelect'
import { HideMeaningsToggle } from '@/components/list/HideMeaningsToggle'
import { SortSelect, type SortSelectLabels } from '@/components/list/SortSelect'
import type { SortOrder, WordSort } from '@/lib/constants'
import type { WordFilterOption } from '@/types/domain'

interface FilterBarLabels {
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
  sorting: SortSelectLabels
  hideActions: string
  showActions: string
}

interface FilterBarProps {
  levels?: WordFilterOption[]
  partsOfSpeech: WordFilterOption[]
  topics: WordFilterOption[]
  showLevelFilter?: boolean
  showTopicFilter?: boolean
  selectedLevel?: string
  searchQuery: string
  selectedPartOfSpeech: string
  selectedTopic: string
  hideMeanings: boolean
  hideActions: boolean
  selectedSort: WordSort
  selectedOrder: SortOrder
  canUsePersonalSorts: boolean
  labels: FilterBarLabels
  onLevelChange?: (value: string) => void
  onSearchQueryChange: (value: string) => void
  onPartOfSpeechChange: (value: string) => void
  onTopicChange: (value: string) => void
  onSortChange: (sort: WordSort, order: SortOrder) => void
  onHideMeaningsChange: (checked: boolean) => void
  onHideActionsChange: (checked: boolean) => void
}

export function FilterBar({
  levels = [],
  partsOfSpeech,
  topics,
  showLevelFilter = false,
  showTopicFilter = true,
  selectedLevel = '',
  searchQuery,
  selectedPartOfSpeech,
  selectedTopic,
  hideMeanings,
  hideActions,
  selectedSort,
  selectedOrder,
  canUsePersonalSorts,
  labels,
  onLevelChange,
  onSearchQueryChange,
  onPartOfSpeechChange,
  onTopicChange,
  onSortChange,
  onHideMeaningsChange,
  onHideActionsChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 border-y border-[var(--line)] py-4 lg:flex-row lg:items-center">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {showLevelFilter && onLevelChange ? (
          <FilterSelect
            label={labels.level}
            options={[{ value: '', label: labels.allLevels }, ...levels]}
            value={selectedLevel}
            onChange={onLevelChange}
          />
        ) : null}
        <FilterSelect
          label={labels.partOfSpeech}
          options={[{ value: '', label: labels.allPartsOfSpeech }, ...partsOfSpeech]}
          value={selectedPartOfSpeech}
          onChange={onPartOfSpeechChange}
        />
        {showTopicFilter ? (
          <FilterSelect
            label={labels.topic}
            options={[{ value: '', label: labels.allTopics }, ...topics]}
            value={selectedTopic}
            onChange={onTopicChange}
          />
        ) : null}
        <SortSelect
          canUsePersonalSorts={canUsePersonalSorts}
          labels={labels.sorting}
          order={selectedOrder}
          sort={selectedSort}
          onChange={onSortChange}
        />
        <label className="relative w-full sm:w-auto sm:max-w-64 sm:min-w-44 sm:flex-1">
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
            className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--card)] pr-3.5 pl-9 text-sm text-[var(--ink)] transition-colors placeholder:text-[var(--mute)] hover:border-[var(--mute)] focus-visible:border-[var(--mute)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
            maxLength={100}
            placeholder={labels.searchPlaceholder}
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <HideMeaningsToggle
          checked={hideMeanings}
          hideLabel={labels.hideMeanings}
          showLabel={labels.showMeanings}
          onChange={onHideMeaningsChange}
        />
        <HideMeaningsToggle
          checked={hideActions}
          hideLabel={labels.hideActions}
          showLabel={labels.showActions}
          onChange={onHideActionsChange}
        />
      </div>
    </div>
  )
}
