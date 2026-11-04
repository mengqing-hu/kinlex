'use client'

import { Fragment } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'

export interface FilterSelectOption {
  value: string
  label: string
  // A second, quieter line under the label in the menu.
  hint?: string
  // Shown after the label in the menu, not on the closed pill.
  count?: number
  // Sets the option apart from the ones above it.
  separated?: boolean
  disabled?: boolean
}

interface FilterSelectProps {
  label: string
  // The first option is the unfiltered one (value ''); choosing anything else highlights the pill.
  options: FilterSelectOption[]
  value: string
  title?: string
  onChange: (value: string) => void
}

export function FilterSelect({ label, options, value, title, onChange }: FilterSelectProps) {
  const selected = options.find((option) => option.value === value)
  const active = value !== '' && selected !== undefined
  const shown = active ? selected.label : label
  // Every text the pill can show, stacked in one grid cell, so it keeps the width of the longest
  // and does not resize when the choice changes.
  const texts = [
    label,
    ...options.filter((option) => option.value !== '').map(({ label }) => label),
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={selected ? `${label}: ${selected.label}` : label}
        className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none ${
          active
            ? 'border-[var(--root)]/50 bg-[var(--root)]/15 text-[var(--ink)] hover:border-[var(--root)]/70 data-[state=open]:border-[var(--root)]/70'
            : 'border-[var(--line)] bg-[var(--card)] text-[var(--mute)] hover:border-[var(--mute)] hover:text-[var(--ink)] data-[state=open]:border-[var(--mute)]'
        }`}
        title={title ?? (active ? selected.label : undefined)}
      >
        {/* Capped, so a long topic name does not push the other filters to a new row. */}
        <span className="inline-grid max-w-24 text-left">
          {texts.map((text) => (
            <span
              aria-hidden="true"
              className={`col-start-1 row-start-1 truncate ${text === shown ? '' : 'invisible'}`}
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
      <DropdownMenuContent className="max-h-80 overflow-y-auto">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((option) => (
            <Fragment key={option.value || 'all'}>
              {option.separated ? <DropdownMenuSeparator /> : null}
              <DropdownMenuRadioItem disabled={option.disabled} value={option.value}>
                <span className="flex-1">
                  {option.label}
                  {option.hint ? (
                    <span className="block text-xs font-normal text-[var(--mute)]">
                      {option.hint}
                    </span>
                  ) : null}
                </span>
                {option.count === undefined ? null : (
                  <span className="ml-4 self-start text-xs leading-5 font-normal text-[var(--mute)] tabular-nums">
                    {option.count}
                  </span>
                )}
              </DropdownMenuRadioItem>
            </Fragment>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
