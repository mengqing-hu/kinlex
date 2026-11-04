'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'

export interface FilterSelectOption {
  value: string
  label: string
  // Shown on the pill instead of label, for choices too long to fit it.
  shortLabel?: string
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
  const pillText = (option: FilterSelectOption) => option.shortLabel ?? option.label
  const shown = active ? pillText(selected) : label
  // Every text the pill can show, stacked in one grid cell, so it keeps the width of the longest
  // and does not resize when the choice changes.
  const texts = [label, ...options.filter((option) => option.value !== '').map(pillText)]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={selected ? `${label}: ${selected.label}` : label}
        className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none ${
          active
            ? 'border-[var(--root)]/50 bg-[var(--root)]/15 text-[var(--ink)] hover:border-[var(--root)]/70 data-[state=open]:border-[var(--root)]/70'
            : 'border-[var(--line)] bg-[var(--card)] text-[var(--mute)] hover:border-[var(--mute)] hover:text-[var(--ink)] data-[state=open]:border-[var(--mute)]'
        }`}
        title={title}
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
      <DropdownMenuContent className="max-h-80 overflow-y-auto">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem
              disabled={option.disabled}
              key={option.value || 'all'}
              value={option.value}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
