import type { ReactNode } from 'react'

export const wordListViews = ['list', 'cards'] as const
export type WordListView = (typeof wordListViews)[number]

export interface ViewToggleLabels {
  view: string
  list: string
  cards: string
}

interface ViewToggleProps {
  view: WordListView
  labels: ViewToggleLabels
  onChange: (view: WordListView) => void
}

const icons: Record<WordListView, ReactNode> = {
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  cards: (
    <>
      <rect height="7" rx="1.5" width="7" x="3.5" y="3.5" />
      <rect height="7" rx="1.5" width="7" x="13.5" y="3.5" />
      <rect height="7" rx="1.5" width="7" x="3.5" y="13.5" />
      <rect height="7" rx="1.5" width="7" x="13.5" y="13.5" />
    </>
  ),
}

// Two buttons in one pill with the outline of the filters beside it; the chosen view sits inside
// as a smaller pill of its own, in the tint the filters use for a chosen value. Like the filters,
// the outline darkens under the pointer.
export function ViewToggle({ view, labels, onChange }: ViewToggleProps) {
  return (
    <div
      aria-label={labels.view}
      className="inline-flex h-9 items-stretch gap-0.5 rounded-full border border-[var(--line)] bg-[var(--card)] p-0.5 transition-colors hover:border-[var(--mute)]"
      role="group"
    >
      {wordListViews.map((option) => (
        <button
          aria-label={labels[option]}
          aria-pressed={view === option}
          className={`group/view inline-flex w-9 items-center justify-center rounded-full transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none ${
            view === option
              ? 'bg-[var(--root)]/15 text-[var(--ink)] active:bg-[var(--root)]/25'
              : 'text-[var(--mute)] hover:bg-[var(--bg)] hover:text-[var(--ink)] active:bg-[var(--line)]'
          }`}
          key={option}
          title={labels[option]}
          type="button"
          onClick={() => onChange(option)}
        >
          <svg
            aria-hidden="true"
            // Pressing a view shrinks its icon a little, so the click is felt before the list changes.
            className="size-4 transition-transform duration-100 group-active/view:scale-85"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            {icons[option]}
          </svg>
        </button>
      ))}
    </div>
  )
}
