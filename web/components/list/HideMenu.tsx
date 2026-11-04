'use client'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'

export interface HideMenuLabels {
  hide: string
  meanings: string
  actions: string
}

interface HideMenuProps {
  hideMeanings: boolean
  hideActions: boolean
  labels: HideMenuLabels
  onHideMeaningsChange: (hidden: boolean) => void
  onHideActionsChange: (hidden: boolean) => void
}

// One pill for the parts of each word a learner can hide, such as the meanings to test themselves.
export function HideMenu({
  hideMeanings,
  hideActions,
  labels,
  onHideMeaningsChange,
  onHideActionsChange,
}: HideMenuProps) {
  const hidden = [hideMeanings && labels.meanings, hideActions && labels.actions].filter(Boolean)
  const active = hidden.length > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={active ? `${labels.hide}: ${hidden.join(', ')}` : labels.hide}
        className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none ${
          active
            ? 'border-[var(--root)]/50 bg-[var(--root)]/15 text-[var(--ink)] hover:border-[var(--root)]/70 data-[state=open]:border-[var(--root)]/70'
            : 'border-[var(--line)] bg-[var(--card)] text-[var(--mute)] hover:border-[var(--mute)] hover:text-[var(--ink)] data-[state=open]:border-[var(--mute)]'
        }`}
      >
        {labels.hide}
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
      <DropdownMenuContent align="end" className="min-w-40">
        {/* Ticking an option keeps the menu open, so both can be set in one go. */}
        <DropdownMenuCheckboxItem
          checked={hideMeanings}
          onCheckedChange={(checked) => onHideMeaningsChange(checked === true)}
          onSelect={(event) => event.preventDefault()}
        >
          {labels.meanings}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={hideActions}
          onCheckedChange={(checked) => onHideActionsChange(checked === true)}
          onSelect={(event) => event.preventDefault()}
        >
          {labels.actions}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
