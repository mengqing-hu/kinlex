'use client'

import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { PanelCloseButton, panelSectionLabelClass, SidePanel } from '@/components/ui/SidePanel'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
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
  original: string
  translation: string
  inThisVideo: string
  playSentence: string
  dictionaryForm: string
  notInVocabulary: string
  close: string
  searchWords: string
  noMatches: string
  searchHint: string
  inVocabulary: string
  similarSpelling: string
  wordPanel: WordPanelLabels
}

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
      className={`flex cursor-pointer gap-3 rounded-xl px-3 py-2.5 transition-colors ${
        isCurrent
          ? 'bg-[var(--card)] shadow-sm ring-1 ring-[var(--line)]'
          : 'hover:bg-[var(--row-hover)]'
      }`}
      data-line={index}
      onClick={() => onPlay(line)}
    >
      <button
        aria-label={`${playLabel} ${formatTime(line.startMs)}`}
        className="shrink-0 pt-0.5 font-mono text-xs text-[var(--mute)] hover:text-[var(--ink)]"
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
          <p className="text-sm leading-6 text-[var(--ink)]">
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
  onPlay,
}: {
  line: StudyLine
  token: StudyToken
  labels: VideoStudyLabels
  onPlay: () => void
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
        <button
          className="text-xs font-semibold text-[var(--info)] hover:underline"
          type="button"
          onClick={onPlay}
        >
          ▶ {labels.playSentence} · {formatTime(line.startMs)}
        </button>
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
  const playLine = useCallback((line: StudyLine) => {
    const player = videoRef.current
    if (!player) return
    player.currentTime = line.startMs / 1000
    void player.play()
  }, [])

  const selectWord = useCallback((line: number, token: number) => {
    videoRef.current?.pause()
    setSelection({ kind: 'caption', line, token })
  }, [])

  const caption = selection?.kind === 'caption' ? selection : null
  const selectedLine = caption ? video.lines[caption.line] : undefined
  const selectedToken = caption ? selectedLine?.tokens[caption.token] : undefined
  // Closing a word goes back to the search and its results.
  const closePanel = () => setSelection(null)
  const searchBox = (
    <WordSearchBox
      focus={selection === null && query !== ''}
      label={labels.searchWords}
      value={query}
      onChange={(value) => {
        setQuery(value)
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
        onPlay={() => playLine(selectedLine)}
      />
    ) : null

  const toggleClass = (on: boolean) =>
    `rounded-md border px-2 py-1 text-xs font-semibold transition-colors ${
      on
        ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--card)]'
        : 'border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)]'
    }`

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-4 md:h-dvh md:px-6 md:py-6">
      <video
        className="aspect-video w-full shrink-0 rounded-2xl bg-black md:max-h-[48dvh]"
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

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold tracking-[0.08em] text-[var(--mute)] uppercase">
            {labels.captions}
          </h2>
          <div className="flex gap-1.5">
            <button
              aria-pressed={showOriginal}
              className={toggleClass(showOriginal)}
              type="button"
              onClick={() => setShowOriginal((on) => !on)}
            >
              {labels.original}
            </button>
            <button
              aria-pressed={showTranslation}
              className={toggleClass(showTranslation)}
              type="button"
              onClick={() => setShowTranslation((on) => !on)}
            >
              {labels.translation}
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1 space-y-1 overflow-y-auto pr-1" ref={listRef}>
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
      ) : (
        <SidePanel busy={false} label={labels.searchWords} persistent onClose={() => setQuery('')}>
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
      )}
    </main>
  )
}
