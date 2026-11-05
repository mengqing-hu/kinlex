'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import type { SortOrder, WordSort } from '@/lib/constants'

export interface SortSelectLabels<S extends string = WordSort> {
  sort: string
  sortBy: string
  // The menu item that goes back to the list's usual order.
  default: string
  // Spoken after the current direction on the direction button.
  reverse: string
  // Why some sorts cannot be chosen, such as sorting by what the learner did without an account.
  disabledHint?: string
  sorts: Record<S, string>
  // What each direction means for each sort, such as "Most viewed first".
  orders: Record<S, Record<SortOrder, string>>
}

interface SortSelectProps<S extends string> {
  sorts: readonly S[]
  // The order the list uses while no sort is chosen.
  defaultSort: S
  // The direction each sort starts in when chosen.
  defaultOrders: Record<S, SortOrder>
  disabledSorts?: readonly S[]
  // The sort the reader chose, or null for the list's usual order. Any choice highlights the
  // control and names the sort, even one that orders the list as the default does.
  sort: S | null
  order: SortOrder
  labels: SortSelectLabels<S>
  // Called with null when the reader goes back to the default.
  onChange: (sort: S | null, order: SortOrder) => void
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

export function SortSelect<S extends string>({
  sorts,
  defaultSort,
  defaultOrders,
  disabledSorts = [],
  sort,
  order,
  labels,
  onChange,
}: SortSelectProps<S>) {
  const active = sort !== null
  const shownSort = sort ?? defaultSort
  const shown = sort === null ? labels.sort : labels.sorts[sort]
  // Every text the control can show, stacked in one grid cell, so it keeps the width of the longest.
  const texts = [labels.sort, ...sorts.map((option) => labels.sorts[option])]

  const nextOrder: SortOrder = order === 'asc' ? 'desc' : 'asc'
  // The menu lists the sorts by name, so it follows the interface language.
  const menuSorts = sorts.toSorted((left, right) =>
    labels.sorts[left].localeCompare(labels.sorts[right]),
  )
  const segmentClassName =
    'inline-flex h-full items-center transition-colors focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none'
  const segmentHoverClassName = active
    ? 'hover:bg-[var(--root)]/15 data-[state=open]:bg-[var(--root)]/15'
    : 'hover:text-[var(--ink)] data-[state=open]:text-[var(--ink)]'

  // Two buttons in one control: the menu of sorts, and the direction, which flips with one click.
  return (
    <div
      className={`inline-flex h-9 items-stretch rounded-lg border text-sm transition-colors ${
        active
          ? 'border-[var(--root)]/50 bg-[var(--root)]/15 text-[var(--ink)]'
          : 'border-[var(--line)] bg-[var(--card)] text-[var(--mute)] hover:border-[var(--mute)]'
      }`}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`${labels.sort}: ${sort === null ? labels.default : labels.sorts[sort]}`}
          className={`${segmentClassName} ${segmentHoverClassName} gap-1.5 rounded-l-lg pr-2.5 pl-3.5`}
          title={disabledSorts.length > 0 ? labels.disabledHint : undefined}
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
            value={sort ?? ''}
            // A new sort starts in its own usual direction.
            onValueChange={(value) =>
              value === ''
                ? onChange(null, defaultOrders[defaultSort])
                : onChange(value as S, defaultOrders[value as S])
            }
          >
            <DropdownMenuRadioItem value="">{labels.default}</DropdownMenuRadioItem>
            {menuSorts.map((option) => (
              <DropdownMenuRadioItem
                disabled={disabledSorts.includes(option)}
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
      {/* The default is one fixed order, so its direction only changes once a sort is chosen. */}
      <button
        aria-label={
          sort === null
            ? labels.orders[shownSort][order]
            : `${labels.orders[shownSort][order]}. ${labels.reverse}`
        }
        className={`${segmentClassName} ${sort === null ? 'cursor-not-allowed opacity-40' : segmentHoverClassName} rounded-r-lg pr-3 pl-2`}
        disabled={sort === null}
        title={labels.orders[shownSort][order]}
        type="button"
        onClick={() => {
          if (sort !== null) onChange(sort, nextOrder)
        }}
      >
        <ArrowIcon order={order} />
      </button>
    </div>
  )
}
