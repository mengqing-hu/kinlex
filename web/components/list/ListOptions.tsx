'use client'

import { type ReactNode, useState } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Switch } from '@/components/ui/Switch'
import type { MarkedWordIds, ResettableWordState } from '@/lib/client/wordStateReset'

// Which side of each word is hidden, so a learner can test themselves on it.
export const hiddenSides = ['word', 'meaning'] as const
export type HiddenSide = (typeof hiddenSides)[number]

export interface ListOptionsLabels {
  listOptions: string
  testYourself: string
  off: string
  hideWord: string
  hideMeaning: string
  display: string
  showActions: string
  actionsHidden: string
  thisList: string
  resetFamiliarity: string
  clearFavorites: string
  /** With `{count}` replaced by the number of words. */
  confirmResetFamiliarity: string
  confirmClearFavorites: string
  cancel: string
  reset: string
  remove: string
  /** With `{count}` replaced by the number of words that changed. */
  familiarityReset: string
  favoritesCleared: string
  resetFailed: string
}

interface ListOptionsProps {
  hidden: HiddenSide | null
  hideActions: boolean
  labels: ListOptionsLabels
  onHiddenChange: (hidden: HiddenSide | null) => void
  onHideActionsChange: (hidden: boolean) => void
  /** Of every word the list's filters match, not just the loaded ones. */
  loadMarkedWordIds: () => Promise<MarkedWordIds>
  /** Resolves to the number of words that changed. */
  onReset: (field: ResettableWordState, wordIds: number[]) => Promise<number>
}

const sideOptions = ['none', ...hiddenSides] as const

// The list's actions look like the filter buttons, only smaller.
const actionButtonClassName =
  'h-8 rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 text-xs font-medium whitespace-nowrap text-[var(--ink)] transition-colors hover:border-[var(--mute)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p
      className="mb-2 text-[11px] font-semibold tracking-widest text-[var(--mute)] uppercase"
      id={id}
    >
      {children}
    </p>
  )
}

type ResetStatus =
  | { kind: 'idle' }
  | { kind: 'confirming'; field: ResettableWordState }
  | { kind: 'working'; field: ResettableWordState }
  | { kind: 'done'; message: string }

// One button that opens the options for the word list: hiding a side of each word to test oneself,
// and starting over on the list's words. Only one side of a word can be hidden at a time, since
// hiding both would leave nothing to test against. Resetting cannot be undone, so it asks first.
export function ListOptions({
  hidden,
  hideActions,
  labels,
  onHiddenChange,
  onHideActionsChange,
  loadMarkedWordIds,
  onReset,
}: ListOptionsProps) {
  const [marked, setMarked] = useState<MarkedWordIds | null>(null)
  const [status, setStatus] = useState<ResetStatus>({ kind: 'idle' })
  const optionLabels = { none: labels.off, word: labels.hideWord, meaning: labels.hideMeaning }
  const activeLabels = [hidden && optionLabels[hidden], hideActions && labels.actionsHidden].filter(
    Boolean,
  )
  const active = activeLabels.length > 0
  const count = (text: string, value: number) => text.replace('{count}', value.toLocaleString())

  function handleOpenChange(open: boolean) {
    if (!open) return
    // The list's filters may have changed since the last time, so count its words afresh.
    setMarked(null)
    setStatus({ kind: 'idle' })
    void loadMarkedWordIds()
      .then(setMarked)
      .catch(() => setMarked({ familiarity: [], favorites: [] }))
  }

  function confirmReset(field: ResettableWordState) {
    if (!marked) return
    setStatus({ kind: 'working', field })
    void onReset(field, marked[field])
      .then((changed) => {
        setMarked({ ...marked, [field]: [] })
        setStatus({
          kind: 'done',
          message: count(
            field === 'familiarity' ? labels.familiarityReset : labels.favoritesCleared,
            changed,
          ),
        })
      })
      .catch(() => setStatus({ kind: 'done', message: labels.resetFailed }))
  }

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger
        aria-label={
          active ? `${labels.listOptions}: ${activeLabels.join(', ')}` : labels.listOptions
        }
        className={`inline-flex h-9 w-12 items-center justify-center rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none ${
          active
            ? 'border-[var(--root)]/50 bg-[var(--root)]/15 text-[var(--ink)] hover:border-[var(--root)]/70 data-[state=open]:border-[var(--root)]/70'
            : 'border-[var(--line)] bg-[var(--card)] text-[var(--mute)] hover:border-[var(--mute)] hover:text-[var(--ink)] data-[state=open]:border-[var(--mute)]'
        }`}
        title={labels.listOptions}
      >
        <svg
          aria-hidden="true"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
      </PopoverTrigger>
      <PopoverContent aria-label={labels.listOptions} className="w-72 space-y-4">
        <section aria-labelledby="list-options-test" role="radiogroup">
          <SectionTitle id="list-options-test">{labels.testYourself}</SectionTitle>
          <div className="flex rounded-lg bg-[var(--bg)] p-0.5">
            {sideOptions.map((option) => (
              <label className="flex-1" key={option}>
                <input
                  checked={(hidden ?? 'none') === option}
                  className="peer sr-only"
                  name="hidden-side"
                  type="radio"
                  value={option}
                  onChange={() => onHiddenChange(option === 'none' ? null : option)}
                />
                <span className="block cursor-pointer rounded-md px-2 py-1.5 text-center text-xs font-medium whitespace-nowrap text-[var(--mute)] transition-colors peer-checked:bg-[var(--card)] peer-checked:text-[var(--ink)] peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--info)] hover:text-[var(--ink)]">
                  {optionLabels[option]}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section aria-labelledby="list-options-display">
          <SectionTitle id="list-options-display">{labels.display}</SectionTitle>
          {/* Put the other way round, as showing, so the switch is on in the usual case. */}
          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-[var(--ink)]">
            {labels.showActions}
            <Switch
              checked={!hideActions}
              onCheckedChange={(shown) => onHideActionsChange(!shown)}
            />
          </label>
        </section>

        <section aria-labelledby="list-options-list">
          <SectionTitle id="list-options-list">{labels.thisList}</SectionTitle>
          {status.kind === 'confirming' || status.kind === 'working' ? (
            <div role="alert">
              <p className="text-sm text-[var(--ink)]">
                {count(
                  status.field === 'familiarity'
                    ? labels.confirmResetFamiliarity
                    : labels.confirmClearFavorites,
                  marked?.[status.field].length ?? 0,
                )}
              </p>
              <div className="mt-2.5 flex justify-end gap-2">
                <button
                  className={actionButtonClassName}
                  disabled={status.kind === 'working'}
                  type="button"
                  onClick={() => setStatus({ kind: 'idle' })}
                >
                  {labels.cancel}
                </button>
                <button
                  className="h-8 rounded-lg bg-[var(--familiarity-1)] px-3.5 text-xs font-medium text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
                  disabled={status.kind === 'working'}
                  type="button"
                  onClick={() => confirmReset(status.field)}
                >
                  {status.field === 'familiarity' ? labels.reset : labels.remove}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {(['familiarity', 'favorites'] as const).map((field) => (
                  <button
                    className={actionButtonClassName}
                    disabled={!marked || marked[field].length === 0}
                    key={field}
                    type="button"
                    onClick={() => setStatus({ kind: 'confirming', field })}
                  >
                    {field === 'familiarity' ? labels.resetFamiliarity : labels.clearFavorites}
                    {/* How many of the list's words it would change; a dash while counting. */}
                    <span className="ml-1.5 text-[var(--mute)] tabular-nums">
                      {marked ? marked[field].length.toLocaleString() : '–'}
                    </span>
                  </button>
                ))}
              </div>
              {status.kind === 'done' ? (
                <p className="mt-2 text-xs text-[var(--mute)]" role="status">
                  {status.message}
                </p>
              ) : null}
            </>
          )}
        </section>
      </PopoverContent>
    </Popover>
  )
}
