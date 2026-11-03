import { HideMeaningsToggle } from '@/components/list/HideMeaningsToggle'
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
  sort: string
  sortDefault: string
  sortFamiliarityAsc: string
  sortFamiliarityDesc: string
  sortSignInHint: string
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
  selectedSort: string
  canSortByFamiliarity: boolean
  labels: FilterBarLabels
  onLevelChange?: (value: string) => void
  onSearchQueryChange: (value: string) => void
  onPartOfSpeechChange: (value: string) => void
  onTopicChange: (value: string) => void
  onSortChange: (value: string) => void
  onHideMeaningsChange: (checked: boolean) => void
  onHideActionsChange: (checked: boolean) => void
}

const selectClassName =
  'min-h-10 rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 text-sm text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--info)]'

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
  canSortByFamiliarity,
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
    <div className="flex flex-col gap-4 border-y border-[var(--line)] py-5 sm:flex-row sm:flex-wrap sm:items-end">
      {showLevelFilter && onLevelChange ? (
        <label className="flex flex-col gap-1.5 text-xs font-semibold tracking-wide text-[var(--mute)] uppercase">
          {labels.level}
          <select
            className={selectClassName}
            value={selectedLevel}
            onChange={(event) => onLevelChange(event.target.value)}
          >
            <option value="">{labels.allLevels}</option>
            {levels.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="flex flex-col gap-1.5 text-xs font-semibold tracking-wide text-[var(--mute)] uppercase">
        {labels.partOfSpeech}
        <select
          className={selectClassName}
          value={selectedPartOfSpeech}
          onChange={(event) => onPartOfSpeechChange(event.target.value)}
        >
          <option value="">{labels.allPartsOfSpeech}</option>
          {partsOfSpeech.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {showTopicFilter ? (
        <label className="flex flex-col gap-1.5 text-xs font-semibold tracking-wide text-[var(--mute)] uppercase">
          {labels.topic}
          <select
            className={selectClassName}
            value={selectedTopic}
            onChange={(event) => onTopicChange(event.target.value)}
          >
            <option value="">{labels.allTopics}</option>
            {topics.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label
        className="flex flex-col gap-1.5 text-xs font-semibold tracking-wide text-[var(--mute)] uppercase"
        title={canSortByFamiliarity ? undefined : labels.sortSignInHint}
      >
        {labels.sort}
        <select
          className={selectClassName}
          value={canSortByFamiliarity ? selectedSort : ''}
          onChange={(event) => onSortChange(event.target.value)}
        >
          <option value="">{labels.sortDefault}</option>
          <option disabled={!canSortByFamiliarity} value="familiarity_asc">
            {labels.sortFamiliarityAsc}
          </option>
          <option disabled={!canSortByFamiliarity} value="familiarity_desc">
            {labels.sortFamiliarityDesc}
          </option>
        </select>
      </label>

      <label className="flex w-full flex-col gap-1.5 text-xs font-semibold tracking-wide text-[var(--mute)] uppercase sm:w-56">
        {labels.searchWords}
        <input
          aria-label={labels.searchWords}
          className={`${selectClassName} w-full font-normal normal-case`}
          maxLength={100}
          placeholder={labels.searchPlaceholder}
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
      </label>

      <div className="flex flex-col gap-2 pb-2 sm:ml-auto">
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
