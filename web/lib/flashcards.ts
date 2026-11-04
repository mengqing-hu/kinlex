// A plain module, so client components can use it without pulling in the validation schemas.

import { wordLevels, type WordLevel } from '@/lib/constants'

export const FLASHCARD_DEFAULT_COUNT = 20
export const FLASHCARD_MAX_COUNT = 100
const SETTINGS_STORAGE_KEY = 'kinlex:flashcard-settings'

export const flashcardSources = ['all', 'favorites', 'learning'] as const
export type FlashcardSource = (typeof flashcardSources)[number]

// Which side faces up: the German word ('de-en') or its meaning ('en-de'); 'mixed' picks one per
// card.
export const flashcardDirections = ['de-en', 'en-de', 'mixed'] as const
export type FlashcardDirection = (typeof flashcardDirections)[number]

export interface FlashcardSettings {
  count: number
  source: FlashcardSource
  // Empty means every level.
  levels: WordLevel[]
  showExample: boolean
  showExampleMeaning: boolean
  direction: FlashcardDirection
  autoplay: boolean
}

export const defaultFlashcardSettings: FlashcardSettings = {
  count: FLASHCARD_DEFAULT_COUNT,
  source: 'all',
  levels: [],
  showExample: true,
  showExampleMeaning: true,
  direction: 'de-en',
  autoplay: false,
}

export const clampFlashcardCount = (value: number) =>
  Math.min(Math.max(Math.round(value), 1), FLASHCARD_MAX_COUNT)

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return options.includes(value as T)
}

// Keeps each stored field that is still valid, so a bad or outdated value only resets itself.
export function readFlashcardSettings(): FlashcardSettings {
  let stored: Record<string, unknown>
  try {
    const value = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}') as unknown
    stored = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  } catch {
    return defaultFlashcardSettings
  }

  const defaults = defaultFlashcardSettings
  const boolean = (value: unknown, fallback: boolean) =>
    typeof value === 'boolean' ? value : fallback
  return {
    count:
      typeof stored.count === 'number' && Number.isFinite(stored.count)
        ? clampFlashcardCount(stored.count)
        : defaults.count,
    source: isOneOf(flashcardSources, stored.source) ? stored.source : defaults.source,
    levels: Array.isArray(stored.levels)
      ? wordLevels.filter((level) => (stored.levels as unknown[]).includes(level))
      : defaults.levels,
    showExample: boolean(stored.showExample, defaults.showExample),
    showExampleMeaning: boolean(stored.showExampleMeaning, defaults.showExampleMeaning),
    direction: isOneOf(flashcardDirections, stored.direction)
      ? stored.direction
      : defaults.direction,
    autoplay: boolean(stored.autoplay, defaults.autoplay),
  }
}

export function writeFlashcardSettings(settings: FlashcardSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Without storage the settings last until the page is closed.
  }
}
