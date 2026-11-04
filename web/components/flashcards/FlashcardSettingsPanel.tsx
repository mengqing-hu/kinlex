'use client'

import { type ReactNode, useState } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Switch } from '@/components/ui/Switch'
import { wordLevels } from '@/lib/constants'
import {
  clampFlashcardCount,
  FLASHCARD_MAX_COUNT,
  flashcardDirections,
  type FlashcardDirection,
  type FlashcardSettings,
  type FlashcardSource,
  flashcardSources,
} from '@/lib/flashcards'

export interface FlashcardSettingsLabels {
  settings: string
  wordsSection: string
  wordsHint: string
  source: string
  sources: Record<FlashcardSource, string>
  levels: string
  levelsHint: string
  cardCount: string
  // Template: {max}.
  cardCountHint: string
  startRound: string
  cardSection: string
  direction: string
  directions: Record<FlashcardDirection, string>
  showExample: string
  showExampleMeaning: string
  autoplay: string
}

interface FlashcardSettingsPanelProps {
  open: boolean
  settings: FlashcardSettings
  // True when the word choices differ from the ones the current round was drawn with.
  roundIsOutdated: boolean
  labels: FlashcardSettingsLabels
  onOpenChange: (open: boolean) => void
  onChange: (settings: FlashcardSettings) => void
  onStartRound: () => void
}

function parseCount(text: string): number | null {
  const value = Number(text)
  return text.trim() !== '' && Number.isInteger(value) ? value : null
}

function SettingsGroup({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <fieldset className="border-t border-[var(--line)] pt-3 first-of-type:border-t-0 first-of-type:pt-0">
      <legend className="float-left w-full text-xs font-semibold tracking-widest text-[var(--mute)] uppercase">
        {title}
      </legend>
      <div className="clear-both space-y-3 pt-2">{children}</div>
      {hint ? <p className="mt-2 text-xs text-[var(--mute)]">{hint}</p> : null}
    </fieldset>
  )
}

interface ChoiceGroupProps<T extends string> {
  label: string
  name: string
  options: readonly T[]
  optionLabels: Record<T, string>
  value: T
  onChange: (value: T) => void
}

function ChoiceGroup<T extends string>({
  label,
  name,
  options,
  optionLabels,
  value,
  onChange,
}: ChoiceGroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={label}>
      <p className="mb-1.5 text-sm text-[var(--ink)]">{label}</p>
      <div className="flex rounded-lg bg-[var(--bg)] p-0.5">
        {options.map((option) => (
          <label className="flex-1" key={option}>
            <input
              checked={value === option}
              className="peer sr-only"
              name={name}
              type="radio"
              value={option}
              onChange={() => onChange(option)}
            />
            <span className="block cursor-pointer rounded-md px-2 py-1 text-center text-xs font-medium text-[var(--mute)] transition-colors peer-checked:bg-[var(--card)] peer-checked:text-[var(--ink)] peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--info)] hover:text-[var(--ink)]">
              {optionLabels[option]}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

function SwitchRow({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      className={`flex items-center justify-between gap-3 text-sm text-[var(--ink)] ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
    >
      {label}
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  )
}

function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  )
}

export function FlashcardSettingsPanel({
  open,
  settings,
  roundIsOutdated,
  labels,
  onOpenChange,
  onChange,
  onStartRound,
}: FlashcardSettingsPanelProps) {
  // What the user is typing into the count field; null shows the setting itself.
  const [countDraft, setCountDraft] = useState<string | null>(null)
  const update = (changes: Partial<FlashcardSettings>) => onChange({ ...settings, ...changes })

  function changeCount(text: string) {
    setCountDraft(text)
    const value = parseCount(text)
    if (value !== null && value >= 1 && value <= FLASHCARD_MAX_COUNT) update({ count: value })
  }

  function settleCount() {
    if (countDraft === null) return
    const value = parseCount(countDraft)
    const count = value === null ? settings.count : clampFlashcardCount(value)
    setCountDraft(null)
    if (count !== settings.count) update({ count })
  }

  function toggleLevel(level: (typeof wordLevels)[number]) {
    update({
      levels: settings.levels.includes(level)
        ? settings.levels.filter((current) => current !== level)
        : wordLevels.filter((current) => current === level || settings.levels.includes(current)),
    })
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Closing removes the field before it can blur, so settle a half-typed count here.
        if (!next) settleCount()
        onOpenChange(next)
      }}
    >
      <PopoverTrigger
        aria-label={labels.settings}
        className="inline-flex size-9 items-center justify-center rounded-full text-[var(--mute)] transition-colors hover:bg-[var(--row-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none data-[state=open]:bg-[var(--row-hover)] data-[state=open]:text-[var(--ink)]"
        title={labels.settings}
      >
        <GearIcon />
      </PopoverTrigger>
      <PopoverContent aria-label={labels.settings} className="max-h-[80dvh] w-80 overflow-y-auto">
        <p className="mb-3 text-sm font-semibold">{labels.settings}</p>
        <div className="space-y-4">
          <SettingsGroup title={labels.wordsSection} hint={labels.wordsHint}>
            <ChoiceGroup
              label={labels.source}
              name="flashcard-source"
              options={flashcardSources}
              optionLabels={labels.sources}
              value={settings.source}
              onChange={(source) => update({ source })}
            />
            <div role="group" aria-label={labels.levels}>
              <p className="mb-1.5 text-sm text-[var(--ink)]">{labels.levels}</p>
              <div className="flex flex-wrap gap-1.5">
                {wordLevels.map((level) => (
                  <label key={level}>
                    <input
                      checked={settings.levels.includes(level)}
                      className="peer sr-only"
                      type="checkbox"
                      onChange={() => toggleLevel(level)}
                    />
                    <span className="block cursor-pointer rounded-full border border-[var(--line)] px-2.5 py-0.5 text-xs font-semibold text-[var(--mute)] transition-colors peer-checked:border-[var(--root)] peer-checked:bg-[var(--root)] peer-checked:text-[var(--card)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--info)] hover:text-[var(--ink)] peer-checked:hover:text-[var(--card)]">
                      {level}
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-[var(--mute)]">{labels.levelsHint}</p>
            </div>
            <label className="flex items-center justify-between gap-3 text-sm text-[var(--ink)]">
              <span>
                {labels.cardCount}
                <span className="block text-xs text-[var(--mute)]">
                  {labels.cardCountHint.replace('{max}', String(FLASHCARD_MAX_COUNT))}
                </span>
              </span>
              <input
                className="w-20 rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 text-base text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
                inputMode="numeric"
                max={FLASHCARD_MAX_COUNT}
                min={1}
                step={1}
                type="number"
                value={countDraft ?? String(settings.count)}
                onBlur={settleCount}
                onChange={(event) => changeCount(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
              />
            </label>
            {roundIsOutdated ? (
              <button
                className="w-full rounded-full bg-[var(--ink)] px-4 py-1.5 text-sm font-semibold text-[var(--card)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
                type="button"
                onClick={onStartRound}
              >
                {labels.startRound}
              </button>
            ) : null}
          </SettingsGroup>

          <SettingsGroup title={labels.cardSection}>
            <ChoiceGroup
              label={labels.direction}
              name="flashcard-direction"
              options={flashcardDirections}
              optionLabels={labels.directions}
              value={settings.direction}
              onChange={(direction) => update({ direction })}
            />
            <SwitchRow
              checked={settings.showExample}
              label={labels.showExample}
              onChange={(showExample) => update({ showExample })}
            />
            <SwitchRow
              checked={settings.showExampleMeaning}
              disabled={!settings.showExample}
              label={labels.showExampleMeaning}
              onChange={(showExampleMeaning) => update({ showExampleMeaning })}
            />
            <SwitchRow
              checked={settings.autoplay}
              label={labels.autoplay}
              onChange={(autoplay) => update({ autoplay })}
            />
          </SettingsGroup>
        </div>
      </PopoverContent>
    </Popover>
  )
}
