'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import {
  defaultSortOrders,
  personalWordSorts,
  type SortOrder,
  type WordSort,
  wordSorts,
} from '@/lib/constants'

export interface SortSelectLabels {
  sort: string
  sortBy: string
  // Spoken after the current direction on the direction button.
  reverse: string
  // Sorting by what the learner did needs an account.
  signInHint: string
  sorts: Record<WordSort, string>
  // What each direction means for each sort, such as "Most viewed first".
  orders: Record<WordSort, Record<SortOrder, string>>
}

interface SortSelectProps {
  sort: WordSort
  order: SortOrder
  canUsePersonalSorts: boolean
  labels: SortSelectLabels
  onChange: (sort: WordSort, order: SortOrder) => void
}

function ArrowIcon({ order }: { order: SortOrder }) {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      viewBox="0 0 24 24"
    >
      {order === 'asc' ? <path d="M12 19V5m-6 6 6-6 6 6" /> : <path d="M12 5v14m6-6-6 6-6-6" />}
    </svg>
  )
}

export function SortSelect({
  sort,
  order,
  canUsePersonalSorts,
  labels,
  onChange,
}: SortSelectProps) {
  const active = sort !== 'frequency' || order !== defaultSortOrders.frequency
  const shown = active ? labels.sorts[sort] : labels.sort
  // Every text the pill can show, stacked in one grid cell, so it keeps the width of the longest.
  const texts = [labels.sort, ...wordSorts.map((option) => labels.sorts[option])]

  const nextOrder: SortOrder = order === 'asc' ? 'desc' : 'asc'
  // The menu lists the sorts by name, so it follows the interface language.
  const menuSorts = wordSorts.toSorted((left, right) =>
    labels.sorts[left].localeCompare(labels.sorts[right]),
  )
  const segmentClassName =
    'inline-flex h-full items-center transition-colors focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none'
  const segmentHoverClassName = active
    ? 'hover:bg-[var(--root)]/15 data-[state=open]:bg-[var(--root)]/15'
    : 'hover:text-[var(--ink)] data-[state=open]:text-[var(--ink)]'

  // Two buttons in one pill: the menu of sorts, and the direction, which flips with one click.
  return (
    <div
      className={`inline-flex h-9 items-stretch rounded-full border text-sm transition-colors ${
        active
          ? 'border-[var(--root)]/50 bg-[var(--root)]/15 text-[var(--ink)]'
          : 'border-[var(--line)] bg-[var(--card)] text-[var(--mute)] hover:border-[var(--mute)]'
      }`}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`${labels.sort}: ${labels.sorts[sort]}`}
          className={`${segmentClassName} ${segmentHoverClassName} gap-1.5 rounded-l-full pr-2.5 pl-3.5`}
          title={canUsePersonalSorts ? undefined : labels.signInHint}
        >
          <span className="inline-grid text-left">
            {texts.map((text) => (
              <span
                aria-hidden="true"
                className={`col-start-1 row-start-1 whitespace-nowrap ${text === shown ? '' : 'invisible'}`}
                key={text}
              >
                {text}
              </span>
            ))}
          </span>
          <svg
            aria-hidden="true"
            className="size-3.5 opacity-60"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.2"
            viewBox="0 0 24 24"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-48">
          <DropdownMenuLabel>{labels.sortBy}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={sort}
            // A new sort starts in its own usual direction.
            onValueChange={(value) =>
              onChange(value as WordSort, defaultSortOrders[value as WordSort])
            }
          >
            {menuSorts.map((option) => (
              <DropdownMenuRadioItem
                disabled={!canUsePersonalSorts && personalWordSorts.includes(option)}
                key={option}
                value={option}
              >
                {labels.sorts[option]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <span
        aria-hidden="true"
        className={`my-2 w-px ${active ? 'bg-[var(--root)]/40' : 'bg-[var(--line)]'}`}
      />
      <button
        aria-label={`${labels.orders[sort][order]}. ${labels.reverse}`}
        className={`${segmentClassName} ${segmentHoverClassName} rounded-r-full pr-3 pl-2`}
        title={labels.orders[sort][order]}
        type="button"
        onClick={() => onChange(sort, nextOrder)}
      >
        <ArrowIcon order={order} />
      </button>
    </div>
  )
}
