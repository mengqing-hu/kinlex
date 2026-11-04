'use client'

import { type MouseEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

import { AudioButton } from '@/components/audio/AudioButton'
import { ExampleLine } from '@/components/word/ExampleLine'
import { fetchApiData } from '@/lib/client/apiClient'
import { queueActivityEvent } from '@/lib/client/eventQueue'
import {
  FLASHCARD_COUNT_STORAGE_KEY,
  FLASHCARD_DEFAULT_COUNT,
  FLASHCARD_MAX_COUNT,
} from '@/lib/flashcards'
import { formatPartOfSpeech } from '@/lib/utils/partOfSpeech'
import type { WordListItem } from '@/types/domain'

type FlashcardResult = 'know' | 'learning'

export interface FlashcardLabels {
  title: string
  cardCount: string
  stillLearning: string
  know: string
  // Templates: {current} {total}, {word}, {learning} {know}.
  progress: string
  flipHintBefore: string
  flipHintAfter: string
  space: string
  playWord: string
  playExample: string
  slowAudio: string
  loading: string
  loadError: string
  saveError: string
  retry: string
  empty: string
  roundDone: string
  roundSummary: string
  nextRound: string
  noMeaning: string
  noRecording: string
  partsOfSpeech: Record<string, string>
}

interface FlashcardSessionProps {
  language: string
  labels: FlashcardLabels
}

type Phase = 'loading' | 'error' | 'empty' | 'playing' | 'done'

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )
}

function parseCount(text: string): number | null {
  const value = Number(text)
  return text.trim() !== '' && Number.isInteger(value) ? value : null
}

const clampCount = (value: number) => Math.min(Math.max(value, 1), FLASHCARD_MAX_COUNT)

function readStoredCount(): number {
  try {
    const stored = parseCount(window.localStorage.getItem(FLASHCARD_COUNT_STORAGE_KEY) ?? '')
    return stored === null ? FLASHCARD_DEFAULT_COUNT : clampCount(stored)
  } catch {
    return FLASHCARD_DEFAULT_COUNT
  }
}

function storeCount(count: number): void {
  try {
    window.localStorage.setItem(FLASHCARD_COUNT_STORAGE_KEY, String(count))
  } catch {
    // Without storage the count goes back to the default on the next visit.
  }
}

const fetchRound = (language: string, size: number) =>
  fetchApiData<WordListItem[]>(
    `/api/v1/me/flashcards?lang=${encodeURIComponent(language)}&limit=${size}`,
    { cache: 'no-store' },
  )

// Keys typed into a field belong to the field, not to the cards.
function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select') !== null)
  )
}

function Icon({ children, className = 'size-6' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  )
}

export function FlashcardSession({ language, labels }: FlashcardSessionProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  // The round's cards in order; a card answered "still learning" is appended once more.
  const [queue, setQueue] = useState<WordListItem[]>([])
  const [position, setPosition] = useState(0)
  const [flipped, setFlipped] = useState(false)
  // The latest answer per word, so a word seen twice is counted once.
  const [results, setResults] = useState<Map<number, FlashcardResult>>(new Map())
  const [repeated, setRepeated] = useState<Set<number>>(new Set())
  const [saveFailed, setSaveFailed] = useState(false)
  const [count, setCount] = useState(FLASHCARD_DEFAULT_COUNT)
  const [countText, setCountText] = useState(String(FLASHCARD_DEFAULT_COUNT))
  const roundRequest = useRef(0)

  const showRound = useCallback((size: number, cards: WordListItem[]) => {
    setCount(size)
    setCountText(String(size))
    setQueue(cards)
    setPosition(0)
    setFlipped(false)
    setResults(new Map())
    setRepeated(new Set())
    setSaveFailed(false)
    setPhase(cards.length > 0 ? 'playing' : 'empty')
  }, [])

  // Only the latest request may fill the round, in case an earlier one answers late.
  const drawRound = useCallback(
    (size: number) => {
      const request = ++roundRequest.current
      return fetchRound(language, size).then(
        (cards) => {
          if (request === roundRequest.current) showRound(size, cards)
        },
        () => {
          if (request === roundRequest.current) setPhase('error')
        },
      )
    },
    [language, showRound],
  )

  function startRound() {
    setPhase('loading')
    void drawRound(count)
  }

  useEffect(() => {
    // The stored count is only readable in the browser, so the first round waits for it here.
    void drawRound(readStoredCount())
  }, [drawRound])

  const card = phase === 'playing' ? queue[position] : undefined

  const answer = useCallback(
    (result: FlashcardResult) => {
      if (!card) return

      fetchApiData(`/api/v1/me/flashcards/${card.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      }).then(
        () => setSaveFailed(false),
        () => setSaveFailed(true),
      )
      queueActivityEvent({
        language,
        eventType: 'self_test',
        targetType: 'word',
        targetId: card.id,
        value: result === 'know' ? 1 : 0,
      })

      setResults((current) => new Map(current).set(card.id, result))
      let length = queue.length
      if (result === 'learning' && !repeated.has(card.id)) {
        setQueue((current) => [...current, card])
        setRepeated((current) => new Set(current).add(card.id))
        length += 1
      }

      if (position + 1 >= length) {
        setPhase('done')
      } else {
        setPosition(position + 1)
        setFlipped(false)
      }
    },
    [card, language, position, queue.length, repeated],
  )

  useEffect(() => {
    if (phase !== 'playing') return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return

      if (event.key === ' ') {
        // Also keeps a focused button from being pressed by the same key.
        event.preventDefault()
        setFlipped((current) => !current)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        answer('learning')
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        answer('know')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [answer, phase])

  function changeCount(text: string) {
    setCountText(text)
    const value = parseCount(text)
    if (value !== null && value >= 1 && value <= FLASHCARD_MAX_COUNT) {
      setCount(value)
      storeCount(value)
    }
  }

  function settleCount() {
    const value = parseCount(countText)
    const settled = value === null ? count : clampCount(value)
    setCount(settled)
    setCountText(String(settled))
    storeCount(settled)
  }

  function handleCardClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest('button, a')) return
    setFlipped((current) => !current)
  }

  const answers = [...results.values()]
  const learningCount = answers.filter((result) => result === 'learning').length
  const knowCount = answers.length - learningCount
  const total = queue.length
  const done = phase === 'done' ? total : position
  const learningWords = queue.filter(
    (word, index) => results.get(word.id) === 'learning' && queue.indexOf(word) === index,
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">{labels.title}</h1>
        <label className="flex items-center gap-2 text-sm text-[var(--mute)]">
          {labels.cardCount}
          <input
            className="w-20 rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 text-base text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
            inputMode="numeric"
            max={FLASHCARD_MAX_COUNT}
            min={1}
            step={1}
            type="number"
            value={countText}
            onBlur={settleCount}
            onChange={(event) => changeCount(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
          />
        </label>
      </div>

      <div aria-hidden="true" className="mt-4 h-1 overflow-hidden rounded-full bg-[var(--line)]">
        <div
          className="h-full rounded-full bg-[var(--info)] transition-[width] duration-300"
          style={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }}
        />
      </div>

      <div className="mt-5 flex items-center justify-between text-sm font-semibold">
        <span className="flex items-center gap-2 text-[var(--familiarity-1)]">
          <span className="inline-flex h-7 min-w-10 items-center justify-center rounded-full border border-current px-2">
            {learningCount}
          </span>
          {labels.stillLearning}
        </span>
        {card ? (
          <span className="text-xs font-normal text-[var(--mute)]">
            {fill(labels.progress, { current: Math.min(done + 1, total), total })}
          </span>
        ) : null}
        <span className="flex items-center gap-2 text-[var(--familiarity-5)]">
          {labels.know}
          <span className="inline-flex h-7 min-w-10 items-center justify-center rounded-full border border-current px-2">
            {knowCount}
          </span>
        </span>
      </div>

      {card ? (
        <>
          <div className="mt-4 perspective-[1600px]">
            <div
              // Remounting per card shows each new card front side up without a flip animation.
              key={`${position}-${card.id}`}
              className={`relative h-80 cursor-pointer transition-transform duration-500 transform-3d sm:h-96 ${flipped ? 'rotate-x-180' : ''}`}
              onClick={handleCardClick}
            >
              <section
                aria-hidden={flipped}
                className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-sm backface-hidden"
              >
                <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                  <p className="text-4xl font-semibold tracking-tight break-words text-[var(--ink)] sm:text-5xl">
                    {card.lemma}
                    <span className="ml-2 inline-flex align-middle">
                      <AudioButton
                        large
                        url={card.audioUrl}
                        label={fill(labels.playWord, { word: card.lemma })}
                        slowLabel={labels.slowAudio}
                        unavailableLabel={labels.noRecording}
                      />
                    </span>
                  </p>
                  {card.level ? (
                    <p className="mt-3 text-xs font-semibold tracking-widest text-[var(--root)] uppercase">
                      {card.level}
                    </p>
                  ) : null}
                </div>
                <p className="flex items-center justify-center gap-2 bg-[var(--bg)] px-4 py-3 text-sm text-[var(--mute)]">
                  {labels.flipHintBefore}
                  <kbd className="rounded-md border border-[var(--mute)] px-2 py-0.5 font-sans text-xs font-semibold text-[var(--ink)]">
                    {labels.space}
                  </kbd>
                  {labels.flipHintAfter}
                </p>
              </section>

              <section
                aria-hidden={!flipped}
                className="absolute inset-0 flex rotate-x-180 flex-col overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-sm backface-hidden"
              >
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <p className="text-xs text-[var(--mute)]">
                    {formatPartOfSpeech(labels.partsOfSpeech, card.pos, card.posDetail)}
                  </p>
                  <p className="mt-3 text-2xl leading-snug font-semibold text-[var(--ink)] sm:text-3xl">
                    {card.glosses.length > 0 ? card.glosses.join(', ') : labels.noMeaning}
                  </p>
                </div>
                {card.example ? (
                  <div className="mx-auto mt-4 w-full max-w-2xl">
                    <ExampleLine
                      featured
                      unavailableAudioLabel={labels.noRecording}
                      example={card.example}
                      playLabel={labels.playExample}
                      slowLabel={labels.slowAudio}
                      targetWordId={card.id}
                    />
                  </div>
                ) : null}
              </section>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-6">
            <button
              aria-label={labels.stillLearning}
              className="inline-flex h-14 w-24 items-center justify-center rounded-full bg-[var(--row-hover)] text-[var(--familiarity-1)] transition-colors hover:bg-[var(--line)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
              title={`${labels.stillLearning} (←)`}
              type="button"
              onClick={() => answer('learning')}
            >
              <Icon>
                <path d="M6 6l12 12M18 6 6 18" />
              </Icon>
            </button>
            <button
              aria-label={labels.know}
              className="inline-flex h-14 w-24 items-center justify-center rounded-full bg-[var(--row-hover)] text-[var(--familiarity-5)] transition-colors hover:bg-[var(--line)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
              title={`${labels.know} (→)`}
              type="button"
              onClick={() => answer('know')}
            >
              <Icon>
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </Icon>
            </button>
          </div>
          {saveFailed ? (
            <p className="mt-3 text-center text-sm text-[var(--familiarity-1)]" role="status">
              {labels.saveError}
            </p>
          ) : null}
        </>
      ) : (
        <div className="mt-4 flex min-h-80 flex-col items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6 text-center sm:min-h-96">
          {phase === 'loading' ? (
            <p className="text-[var(--mute)]" role="status">
              {labels.loading}
            </p>
          ) : phase === 'error' ? (
            <>
              <p className="text-[var(--ink)]">{labels.loadError}</p>
              <button
                className="mt-4 rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-[var(--card)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
                type="button"
                onClick={startRound}
              >
                {labels.retry}
              </button>
            </>
          ) : phase === 'empty' ? (
            <p className="text-[var(--mute)]">{labels.empty}</p>
          ) : (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
                {labels.roundDone}
              </h2>
              <p className="mt-2 text-[var(--mute)]">
                {fill(labels.roundSummary, { learning: learningCount, know: knowCount })}
              </p>
              {learningWords.length > 0 ? (
                <ul className="mt-5 flex max-w-xl flex-wrap justify-center gap-2">
                  {learningWords.map((word) => (
                    <li
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-sm text-[var(--ink)]"
                      key={word.id}
                    >
                      {word.lemma}
                    </li>
                  ))}
                </ul>
              ) : null}
              <button
                // Lets Enter start the next round straight away.
                autoFocus
                className="mt-6 rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-[var(--card)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
                type="button"
                onClick={startRound}
              >
                {labels.nextRound}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
