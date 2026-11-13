'use client'

import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { PanelCloseButton, panelSectionLabelClass, SidePanel } from '@/components/ui/SidePanel'
import { Switch } from '@/components/ui/Switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import { useVideoChat, VideoChatPanel, type VideoChatLabels } from '@/components/videos/VideoChat'
import {
  findVideoMatches,
  useWordSearch,
  WordSearchBox,
  WordSearchResults,
} from '@/components/videos/WordSearch'
import { WordDetailPanel, type WordPanelLabels } from '@/components/word/WordDetailPanel'
import { useVideoTime } from '@/lib/client/videoTime'
import {
  findLineIndex,
  findSpokenToken,
  toWebVtt,
  type StudyLine,
  type StudyToken,
  type StudyVideo,
} from '@/lib/videos/types'

export interface VideoStudyLabels {
  captions: string
  options: string
  sidePanel: string
  original: string
  translation: string
  inThisVideo: string
  playSentence: string
  sentenceSpeed: string
  dictionaryForm: string
  notInVocabulary: string
  close: string
  searchWords: string
  noMatches: string
  searchHint: string
  inVocabulary: string
  similarSpelling: string
  wordPanel: WordPanelLabels
  chat: VideoChatLabels
}

// What the right column shows when no word is picked, chosen with the captions' tool buttons.
type Tool = 'chat' | 'search'

// The word shown in the right column: one clicked in the captions, or one found by searching.
type Selection = { kind: 'caption'; line: number; token: number } | { kind: 'search'; slug: string }

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

// The sentence with each word as a button; the text between words stays as written. The word
// being said is coloured, and the word picked is highlighted.
function SentenceWords({
  line,
  selectedToken,
  spokenToken,
  onWord,
}: {
  line: StudyLine
  selectedToken: number | null
  spokenToken: number | null
  onWord: (token: number) => void
}) {
  const parts = []
  let offset = 0
  line.tokens.forEach((token, index) => {
    if (token.start > offset) parts.push(line.text.slice(offset, token.start))
    const word = (
      <button
        className={`-mx-px cursor-pointer rounded-sm px-px underline decoration-2 underline-offset-4 transition-colors active:bg-[var(--highlight)] ${
          index === selectedToken
            ? 'bg-[var(--highlight)] decoration-[var(--ink)]'
            : 'decoration-transparent hover:decoration-[var(--ink)]'
        } ${index === spokenToken ? 'text-[var(--info)]' : ''}`}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onWord(index)
        }}
      >
        {line.text.slice(token.start, token.end)}
      </button>
    )
    // Like the example sentences, a word shows its meaning in this sentence on hover.
    parts.push(
      token.gloss ? (
        <Tooltip key={token.start}>
          <TooltipTrigger asChild>{word}</TooltipTrigger>
          <TooltipContent className="pointer-events-none">{token.gloss}</TooltipContent>
        </Tooltip>
      ) : (
        <span key={token.start}>{word}</span>
      ),
    )
    offset = token.end
  })
  if (offset < line.text.length) parts.push(line.text.slice(offset))
  return <>{parts}</>
}

// The speeds a sentence can be played at from the word panel, in the order a click steps through.
// Below normal speed it plays once and stops.
const SENTENCE_RATES = [1, 0.75, 0.5]

// 1.0×, 0.75×, 0.5×: normal speed keeps its decimal, so it reads as one of the speeds.
function formatRate(rate: number): string {
  return `${Number.isInteger(rate) ? rate.toFixed(1) : rate}×`
}
// Further past the slow sentence than this, the learner moved on, so it is not stopped there.
const SLOW_STOP_SLACK_MS = 1000

// Plays from the sentence's start; at the given rate, or the one the learner chose in the player.
function play(player: HTMLVideoElement | null, line: StudyLine, rate?: number) {
  if (!player) return
  if (rate !== undefined) player.playbackRate = rate
  player.currentTime = line.startMs / 1000
  void player.play()
}

function finishSlowPlay(player: HTMLVideoElement | null, pause: boolean) {
  if (!player) return
  if (pause) player.pause()
  player.playbackRate = 1
}

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

// One button, like the word list's options, that opens the page's options: which captions to
// show, and what the right column shows. It is tinted while a caption is hidden.
function StudyOptions({
  labels,
  showOriginal,
  showTranslation,
  tool,
  onShowOriginal,
  onShowTranslation,
  onTool,
}: {
  labels: VideoStudyLabels
  showOriginal: boolean
  showTranslation: boolean
  // What the column shows; null while it is closed or shows a word, so any choice opens it.
  tool: Tool | null
  onShowOriginal: (shown: boolean) => void
  onShowTranslation: (shown: boolean) => void
  onTool: (tool: Tool) => void
}) {
  const captions = [
    { label: labels.original, checked: showOriginal, onChange: onShowOriginal },
    { label: labels.translation, checked: showTranslation, onChange: onShowTranslation },
  ]
  const tools = [
    { value: 'chat', label: labels.chat.chat },
    { value: 'search', label: labels.searchWords },
  ] as const
  const active = !showOriginal || !showTranslation
  return (
    <Popover>
      <PopoverTrigger
        aria-label={labels.options}
        className={`inline-flex h-9 w-12 items-center justify-center rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none ${
          active
            ? 'border-[var(--root)]/50 bg-[var(--root)]/15 text-[var(--ink)] hover:border-[var(--root)]/70 data-[state=open]:border-[var(--root)]/70'
            : 'border-[var(--line)] bg-[var(--card)] text-[var(--mute)] hover:border-[var(--mute)] hover:text-[var(--ink)] data-[state=open]:border-[var(--mute)]'
        }`}
        title={labels.options}
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
      <PopoverContent aria-label={labels.options} className="w-72 space-y-4">
        <section aria-labelledby="study-options-captions">
          <SectionTitle id="study-options-captions">{labels.captions}</SectionTitle>
          <div className="space-y-2.5">
            {captions.map((option) => (
              <label
                className="flex cursor-pointer items-center justify-between gap-3 text-sm text-[var(--ink)]"
                key={option.label}
              >
                {option.label}
                <Switch checked={option.checked} onCheckedChange={option.onChange} />
              </label>
            ))}
          </div>
        </section>

        <section aria-labelledby="study-options-panel" role="radiogroup">
          <SectionTitle id="study-options-panel">{labels.sidePanel}</SectionTitle>
          <div className="flex rounded-lg bg-[var(--bg)] p-0.5">
            {tools.map((option) => (
              <label className="flex-1" key={option.value}>
                <input
                  checked={tool === option.value}
                  className="peer sr-only"
                  name="study-panel"
                  type="radio"
                  value={option.value}
                  onChange={() => onTool(option.value)}
                />
                <span className="block cursor-pointer rounded-md px-2 py-1.5 text-center text-xs font-medium whitespace-nowrap text-[var(--mute)] transition-colors peer-checked:bg-[var(--card)] peer-checked:text-[var(--ink)] peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--info)] hover:text-[var(--ink)]">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </section>
      </PopoverContent>
    </Popover>
  )
}

// Wide enough for the right column to stand beside the captions rather than cover them.
const WIDE_QUERY = '(min-width: 768px)'

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function isWide() {
  return window.matchMedia(WIDE_QUERY).matches
}

function showCaptions(player: HTMLVideoElement | null) {
  const track = player?.textTracks[0]
  if (track) track.mode = 'showing'
}

interface CaptionRowProps {
  line: StudyLine
  index: number
  isCurrent: boolean
  selectedToken: number | null
  spokenToken: number | null
  showOriginal: boolean
  showTranslation: boolean
  playLabel: string
  onPlay: (line: StudyLine) => void
  onWord: (line: number, token: number) => void
}

// One sentence of the list. Memoized: while the video plays the page renders every frame, and
// only the playing sentence changes.
const CaptionRow = memo(function CaptionRow({
  line,
  index,
  isCurrent,
  selectedToken,
  spokenToken,
  showOriginal,
  showTranslation,
  playLabel,
  onPlay,
  onWord,
}: CaptionRowProps) {
  return (
    <div
      className={`flex cursor-pointer items-baseline gap-3 rounded-lg px-3 py-1.5 transition-colors ${
        isCurrent
          ? 'bg-[var(--card)] shadow-sm ring-1 ring-[var(--line)]'
          : 'hover:bg-[var(--row-hover)]'
      }`}
      data-line={index}
      onClick={() => onPlay(line)}
    >
      <button
        aria-label={`${playLabel} ${formatTime(line.startMs)}`}
        className="shrink-0 font-mono text-xs text-[var(--mute)] hover:text-[var(--ink)]"
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onPlay(line)
        }}
      >
        {formatTime(line.startMs)}
      </button>
      <div className="min-w-0 flex-1">
        {showOriginal ? (
          <p className="text-sm leading-5.5 text-[var(--ink)]">
            <SentenceWords
              line={line}
              selectedToken={selectedToken}
              spokenToken={spokenToken}
              onWord={(token) => onWord(index, token)}
            />
          </p>
        ) : null}
        {showTranslation && line.translation ? (
          <p className="text-sm leading-5 text-[var(--mute)]">{line.translation}</p>
        ) : null}
      </div>
    </div>
  )
})

// Where the word was picked: its meaning in this sentence, the sentence, and its translation.
function VideoContext({
  line,
  token,
  labels,
  rate,
  onPlay,
  onNextRate,
}: {
  line: StudyLine
  token: StudyToken
  labels: VideoStudyLabels
  rate: number
  onPlay: () => void
  onNextRate: () => void
}) {
  return (
    <section>
      <h3 className={panelSectionLabelClass}>{labels.inThisVideo}</h3>
      <div className="space-y-2 rounded-xl border border-[var(--line)] bg-[var(--bg)]/60 p-3 text-sm leading-6">
        {token.gloss ? <p className="font-semibold text-[var(--ink)]">{token.gloss}</p> : null}
        <p className="text-[var(--ink)]">
          {line.text.slice(0, token.start)}
          <mark className="rounded bg-[var(--highlight)] px-0.5 text-inherit">
            {line.text.slice(token.start, token.end)}
          </mark>
          {line.text.slice(token.end)}
        </p>
        {line.translation ? <p className="text-[var(--mute)]">{line.translation}</p> : null}
        <div className="flex items-center gap-3">
          <button
            className="text-xs font-semibold text-[var(--info)] hover:underline"
            type="button"
            onClick={onPlay}
          >
            ▶ {labels.playSentence} · {formatTime(line.startMs)}
          </button>
          <button
            aria-label={`${labels.sentenceSpeed}: ${formatRate(rate)}`}
            className={`w-12 rounded-md border py-0.5 text-center text-xs font-semibold tabular-nums hover:border-[var(--info)] ${
              rate < 1
                ? 'border-[var(--info)] text-[var(--info)]'
                : 'border-[var(--line)] text-[var(--mute)]'
            }`}
            title={labels.sentenceSpeed}
            type="button"
            onClick={onNextRate}
          >
            {formatRate(rate)}
          </button>
        </div>
      </div>
    </section>
  )
}

// A word that is not in the vocabulary: what the captions know about it, without dictionary fields.
function VideoWordPanel({
  token,
  labels,
  context,
  header,
  onClose,
}: {
  token: StudyToken
  labels: VideoStudyLabels
  context: ReactNode
  header: ReactNode
  onClose: () => void
}) {
  return (
    <SidePanel busy={false} label={token.surface} onClose={onClose}>
      {header}
      <div className="flex-1 space-y-6 overflow-y-auto px-4 pt-3 pb-4">
        <header className="-mx-4 -mt-3 border-b border-[var(--line)] px-4 pt-3 pb-2">
          <div className="flex items-center gap-0.5">
            <h2 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight text-[var(--ink)]">
              {token.surface}
            </h2>
            <PanelCloseButton label={labels.close} onClose={onClose} />
          </div>
          <p className="mt-0.5 text-xs text-[var(--mute)]">
            {labels.dictionaryForm}: {token.lemma}
          </p>
        </header>
        {context}
        <p className="text-xs text-[var(--mute)]">{labels.notInVocabulary}</p>
      </div>
    </SidePanel>
  )
}

export function VideoStudy({ video, labels }: { video: StudyVideo; labels: VideoStudyLabels }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const timeMs = useVideoTime(videoRef)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [query, setQuery] = useState('')
  // The chat or the search, or neither; a picked word shows over either. The chat is open at
  // first on wide screens; on phones it would cover the captions, so it waits to be picked.
  const wide = useSyncExternalStore(subscribeToWidth, isWide, () => true)
  const [pickedTool, setPickedTool] = useState<Tool | null | undefined>(undefined)
  const toolPicked = pickedTool !== undefined
  const tool = toolPicked ? pickedTool : wide ? 'chat' : null
  const chat = useVideoChat(video)
  const search = useWordSearch(video.language, video.meaningLanguage, query)
  const [showOriginal, setShowOriginal] = useState(true)
  const [showTranslation, setShowTranslation] = useState(true)

  const current = findLineIndex(video.lines, timeMs)
  const currentLine = video.lines[current]
  const spokenToken = currentLine ? findSpokenToken(currentLine, timeMs) : null
  // The player draws the same captions over the picture, also in full screen.
  const captionsVtt = useMemo(
    () => toWebVtt(video.lines, { original: showOriginal, translation: showTranslation }),
    [video.lines, showOriginal, showTranslation],
  )
  const captionsUrl = captionsVtt
    ? `data:text/vtt;charset=utf-8,${encodeURIComponent(captionsVtt)}`
    : null

  // A new track is not always shown by itself once the player has started.
  useEffect(() => {
    showCaptions(videoRef.current)
  }, [captionsUrl])

  // Keeps the playing sentence in the middle of the list, scrolling only the list.
  useEffect(() => {
    const list = listRef.current
    const item = list?.querySelector<HTMLElement>(`[data-line="${current}"]`)
    // Before the layout settles the list has no height, and centring would scroll past the top.
    if (!list || !item || list.clientHeight === 0) return
    list.scrollTo({
      top: item.offsetTop - list.clientHeight / 2 + item.clientHeight / 2,
      behavior: 'smooth',
    })
  }, [current])

  // Stable, so the memoized rows do not render again for them.
  // Where a slowly played sentence ends, to stop there and go back to normal speed.
  const slowStopRef = useRef<number | null>(null)

  const playLine = useCallback((line: StudyLine) => {
    // Interrupting a slow sentence goes back to normal speed; otherwise the speed stays as set.
    const wasSlow = slowStopRef.current !== null
    slowStopRef.current = null
    play(videoRef.current, line, wasSlow ? 1 : undefined)
  }, [])

  const playLineSlowly = useCallback((line: StudyLine, rate: number) => {
    slowStopRef.current = line.endMs
    play(videoRef.current, line, rate)
  }, [])
  const [sentenceRate, setSentenceRate] = useState(1)

  useEffect(() => {
    const stop = slowStopRef.current
    if (stop === null || timeMs < stop) return
    slowStopRef.current = null
    finishSlowPlay(videoRef.current, timeMs < stop + SLOW_STOP_SLACK_MS)
  }, [timeMs])

  const selectWord = useCallback((line: number, token: number) => {
    videoRef.current?.pause()
    setSelection({ kind: 'caption', line, token })
  }, [])

  const caption = selection?.kind === 'caption' ? selection : null
  const selectedLine = caption ? video.lines[caption.line] : undefined
  const selectedToken = caption ? selectedLine?.tokens[caption.token] : undefined
  // Closing a word goes back to the search when it was open, and otherwise closes the column.
  const closePanel = () => setSelection(null)
  const pickTool = (next: Tool | null) => setPickedTool(next)
  const searchBox = (
    <WordSearchBox
      focus={selection === null && (toolPicked || query !== '')}
      label={labels.searchWords}
      value={query}
      onChange={(value) => {
        setQuery(value)
        pickTool('search')
        setSelection(null)
      }}
    />
  )
  const context =
    selectedLine && selectedToken ? (
      <VideoContext
        labels={labels}
        line={selectedLine}
        token={selectedToken}
        rate={sentenceRate}
        onNextRate={() =>
          setSentenceRate(
            (rate) =>
              SENTENCE_RATES[(SENTENCE_RATES.indexOf(rate) + 1) % SENTENCE_RATES.length] ?? 1,
          )
        }
        onPlay={() =>
          sentenceRate < 1 ? playLineSlowly(selectedLine, sentenceRate) : playLine(selectedLine)
        }
      />
    ) : null

  return (
    <main className="flex w-full flex-col md:h-dvh">
      {/* The player fills the top of the column, edge to edge; the captions keep a reading width. */}
      <video
        className="aspect-video w-full shrink-0 bg-black md:max-h-[55dvh]"
        controls
        playsInline
        preload="metadata"
        ref={videoRef}
        src={`/api/v1/videos/${video.id}/media?lang=${video.language}`}
      >
        {captionsUrl ? (
          <track
            default
            key={captionsUrl}
            kind="subtitles"
            label={labels.captions}
            src={captionsUrl}
            srcLang={video.language}
          />
        ) : null}
      </video>

      <section className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col px-4 pt-4 pb-4 md:px-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold tracking-[0.08em] text-[var(--mute)] uppercase">
            {labels.captions}
          </h2>
          <div className="flex gap-1.5">
            <StudyOptions
              labels={labels}
              showOriginal={showOriginal}
              showTranslation={showTranslation}
              tool={selection === null ? tool : null}
              onShowOriginal={setShowOriginal}
              onShowTranslation={setShowTranslation}
              onTool={(next) => {
                pickTool(next)
                setSelection(null)
              }}
            />
          </div>
        </div>
        <div className="relative min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1" ref={listRef}>
          {video.lines.map((line, index) => (
            <CaptionRow
              index={index}
              isCurrent={index === current}
              key={line.position}
              line={line}
              playLabel={labels.playSentence}
              selectedToken={caption?.line === index ? caption.token : null}
              showOriginal={showOriginal}
              showTranslation={showTranslation}
              spokenToken={index === current ? spokenToken : null}
              onPlay={playLine}
              onWord={selectWord}
            />
          ))}
        </div>
      </section>

      {selection?.kind === 'search' || selectedToken?.slug ? (
        <WordDetailPanel
          context={context}
          explainLanguage={video.meaningLanguage}
          header={searchBox}
          labels={labels.wordPanel}
          language={video.language}
          slug={selection?.kind === 'search' ? selection.slug : (selectedToken?.slug ?? '')}
          onClose={closePanel}
        />
      ) : selectedToken ? (
        <VideoWordPanel
          context={context}
          header={searchBox}
          labels={labels}
          token={selectedToken}
          onClose={closePanel}
        />
      ) : tool === 'chat' ? (
        <VideoChatPanel
          chat={chat}
          labels={labels.chat}
          line={Math.max(0, current)}
          onClose={() => pickTool(null)}
        />
      ) : tool === 'search' ? (
        <SidePanel busy={false} label={labels.searchWords} onClose={() => pickTool(null)}>
          {searchBox}
          <div className="flex-1 overflow-y-auto">
            <WordSearchResults
              labels={{ ...labels, partsOfSpeech: labels.wordPanel.partsOfSpeech }}
              query={query}
              search={search}
              videoMatches={findVideoMatches(video.lines, query)}
              onPick={(slug) => setSelection({ kind: 'search', slug })}
              onPickVideoMatch={(match) =>
                setSelection({ kind: 'caption', line: match.line, token: match.token })
              }
            />
          </div>
        </SidePanel>
      ) : null}
    </main>
  )
}
