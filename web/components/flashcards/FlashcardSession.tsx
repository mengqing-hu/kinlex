'use client'

import { useLocale } from 'next-intl'
import { type MouseEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

import { useAudioPlayer } from '@/components/audio/AudioProvider'
import {
  FaceExample,
  type FlashcardFaceLabels,
  MeaningFace,
  WordFace,
} from '@/components/flashcards/FlashcardFaces'
import {
  FlashcardSettingsPanel,
  type FlashcardSettingsLabels,
} from '@/components/flashcards/FlashcardSettingsPanel'
import { fetchApiData } from '@/lib/client/apiClient'
import { queueActivityEvent } from '@/lib/client/eventQueue'
import {
  defaultFlashcardSettings,
  type FlashcardSettings,
  readFlashcardSettings,
  writeFlashcardSettings,
} from '@/lib/flashcards'
import type { WordListItem } from '@/types/domain'

type FlashcardResult = 'know' | 'learning'
type Side = 'word' | 'meaning'

export interface FlashcardLabels {
  title: string
  stillLearning: string
  know: string
  // Templates: {current} {total}, {learning} {know}.
  progress: string
  flipHintBefore: string
  flipHintAfter: string
  space: string
  loading: string
  loadError: string
  saveError: string
  retry: string
  empty: string
  emptyAction: string
  roundDone: string
  roundSummary: string
  nextRound: string
  face: FlashcardFaceLabels
  settings: FlashcardSettingsLabels
}

interface FlashcardSessionProps {
  language: string
  labels: FlashcardLabels
}

type Phase = 'loading' | 'error' | 'empty' | 'playing' | 'done'

// The settings that decide which words a round holds, as opposed to how its cards look.
type DeckQuery = Pick<FlashcardSettings, 'count' | 'source' | 'levels'>

const deckQueryOf = ({ count, source, levels }: FlashcardSettings): DeckQuery => ({
  count,
  source,
  levels,
})

const isSameDeck = (left: DeckQuery, right: DeckQuery) =>
  left.count === right.count &&
  left.source === right.source &&
  left.levels.join() === right.levels.join()

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )
}

function fetchRound(language: string, explainLanguage: string, deck: DeckQuery) {
  const params = new URLSearchParams({
    lang: language,
    explain: explainLanguage,
    limit: String(deck.count),
    source: deck.source,
  })
  if (deck.levels.length > 0) params.set('levels', deck.levels.join(','))
  return fetchApiData<WordListItem[]>(`/api/v1/me/flashcards?${params}`, { cache: 'no-store' })
}

// Keys typed into a field belong to the field, not to the cards.
function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select') !== null)
  )
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="size-6"
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
  const { playAudio } = useAudioPlayer()
  const explainLanguage = useLocale()
  const [settings, setSettings] = useState(defaultFlashcardSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('loading')
  // The word choices the current round was drawn with.
  const [roundDeck, setRoundDeck] = useState<DeckQuery | null>(null)
  const [roundNumber, setRoundNumber] = useState(0)
  // The round's cards in order; a card answered "still learning" is appended once more.
  const [queue, setQueue] = useState<WordListItem[]>([])
  // Which side faces up per word when the direction is mixed, drawn once per round.
  const [mixedSides, setMixedSides] = useState<Map<number, Side>>(new Map())
  const [position, setPosition] = useState(0)
  const [flipped, setFlipped] = useState(false)
  // The latest answer per word, so a word seen twice is counted once.
  const [results, setResults] = useState<Map<number, FlashcardResult>>(new Map())
  const [repeated, setRepeated] = useState<Set<number>>(new Set())
  const [saveFailed, setSaveFailed] = useState(false)
  const roundRequest = useRef(0)
  const autoplayedCard = useRef<string | null>(null)

  const showRound = useCallback((deck: DeckQuery, cards: WordListItem[]) => {
    setRoundDeck(deck)
    setRoundNumber((current) => current + 1)
    setQueue(cards)
    setMixedSides(new Map(cards.map((card) => [card.id, Math.random() < 0.5 ? 'word' : 'meaning'])))
    setPosition(0)
    setFlipped(false)
    setResults(new Map())
    setRepeated(new Set())
    setSaveFailed(false)
    setPhase(cards.length > 0 ? 'playing' : 'empty')
  }, [])

  // Only the latest request may fill the round, in case an earlier one answers late.
  const drawRound = useCallback(
    (deck: DeckQuery, restoredSettings?: FlashcardSettings) => {
      const request = ++roundRequest.current
      return fetchRound(language, explainLanguage, deck).then(
        (cards) => {
          if (request !== roundRequest.current) return
          if (restoredSettings) setSettings(restoredSettings)
          showRound(deck, cards)
        },
        () => {
          if (request === roundRequest.current) setPhase('error')
        },
      )
    },
    [language, explainLanguage, showRound],
  )

  function startRound() {
    setSettingsOpen(false)
    setPhase('loading')
    void drawRound(deckQueryOf(settings))
  }

  useEffect(() => {
    // Stored settings are only readable in the browser, so the first round waits for them here.
    const stored = readFlashcardSettings()
    void drawRound(deckQueryOf(stored), stored)
  }, [drawRound])

  function changeSettings(next: FlashcardSettings) {
    setSettings(next)
    writeFlashcardSettings(next)
  }

  const card = phase === 'playing' ? queue[position] : undefined
  const front: Side =
    settings.direction === 'de-en'
      ? 'word'
      : settings.direction === 'en-de'
        ? 'meaning'
        : card
          ? (mixedSides.get(card.id) ?? 'word')
          : 'word'
  const wordVisible = (front === 'word') !== flipped

  useEffect(() => {
    if (!card?.audioUrl || !settings.autoplay || !wordVisible) return
    // Once per card showing, so flipping back and forth does not replay it.
    const key = `${roundNumber}-${position}`
    if (autoplayedCard.current === key) return
    autoplayedCard.current = key
    playAudio(card.audioUrl)
  }, [card, playAudio, position, roundNumber, settings.autoplay, wordVisible])

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
    // The card under an open settings panel should not move when its keys are pressed.
    if (phase !== 'playing' || settingsOpen) return

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
  }, [answer, phase, settingsOpen])

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
  const roundIsOutdated = roundDeck !== null && !isSameDeck(roundDeck, deckQueryOf(settings))

  function renderSide(side: Side, shownCard: WordListItem) {
    return side === 'word' ? (
      <WordFace card={shownCard} labels={labels.face} />
    ) : (
      <MeaningFace card={shownCard} labels={labels.face} />
    )
  }

  const faceClassName =
    'absolute inset-0 flex flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-sm backface-hidden'
  const primaryButtonClassName =
    'rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-[var(--card)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">{labels.title}</h1>
        <FlashcardSettingsPanel
          labels={labels.settings}
          open={settingsOpen}
          roundIsOutdated={roundIsOutdated}
          settings={settings}
          onChange={changeSettings}
          onOpenChange={setSettingsOpen}
          onStartRound={startRound}
        />
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
              key={`${roundNumber}-${position}`}
              className={`relative h-80 cursor-pointer transition-transform duration-500 transform-3d sm:h-96 ${flipped ? 'rotate-x-180' : ''}`}
              onClick={handleCardClick}
            >
              <section aria-hidden={flipped} className={faceClassName}>
                {renderSide(front, card)}
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
                className={`${faceClassName} rotate-x-180 overflow-y-auto`}
              >
                {renderSide(front === 'word' ? 'meaning' : 'word', card)}
                {settings.showExample ? (
                  <FaceExample
                    card={card}
                    labels={labels.face}
                    showMeaning={settings.showExampleMeaning}
                  />
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
                className={`mt-4 ${primaryButtonClassName}`}
                type="button"
                onClick={startRound}
              >
                {labels.retry}
              </button>
            </>
          ) : phase === 'empty' ? (
            <>
              <p className="text-[var(--mute)]">{labels.empty}</p>
              <button
                className={`mt-4 ${primaryButtonClassName}`}
                type="button"
                onClick={() => setSettingsOpen(true)}
              >
                {labels.emptyAction}
              </button>
            </>
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
                className={`mt-6 ${primaryButtonClassName}`}
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
