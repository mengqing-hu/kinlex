'use client'

import { type ReactNode, useCallback, useState } from 'react'

import {
  GrammarDetailPanel,
  type GrammarPanelLabels,
} from '@/components/grammar/GrammarDetailPanel'
import { FilterSelect } from '@/components/list/FilterSelect'
import { ViewToggle, type ViewToggleLabels, type WordListView } from '@/components/list/ViewToggle'
import { WordDetailPanel, type WordPanelLabels } from '@/components/word/WordDetailPanel'
import {
  updateSearchParameter,
  updateSearchParameters,
  useSearchParamsString,
} from '@/lib/client/searchParams'
import type { GrammarTopic } from '@/lib/grammar/contents'
import type { GrammarDetail } from '@/lib/grammar/details'

export interface GrammarDirectoryLabels {
  allChapters: string
  chapter: string
  empty: string
  introduction: string
  noMatches: string
  panel: GrammarPanelLabels
  search: string
  searchPlaceholder: string
  subsection: string
  subsections: string
  views: ViewToggleLabels
  wordPanel: WordPanelLabels
}

interface GrammarDirectoryProps {
  contents: readonly GrammarTopic[]
  details: Readonly<Record<string, GrammarDetail>>
  labels: GrammarDirectoryLabels
  language: string
}

// Lower case and without accents, so "prasens" and, written the German way, "praesens" both find
// "Präsens".
function searchKey(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

function withoutUmlautSpelling(key: string): string {
  return key.replaceAll('ae', 'a').replaceAll('oe', 'o').replaceAll('ue', 'u')
}

function matchesSearch(topic: GrammarTopic, key: string): boolean {
  const text = searchKey(`${topic.number ?? ''} ${topic.zh} ${topic.de}`)
  return text.includes(key) || text.includes(withoutUmlautSpelling(key))
}

// A topic that matches keeps everything under it; otherwise it stays only as the way to the
// topics under it that match.
function searchTopics(topics: readonly GrammarTopic[], key: string): GrammarTopic[] {
  return topics.flatMap((topic) => {
    if (matchesSearch(topic, key)) return [topic]
    const children = topic.children ? searchTopics(topic.children, key) : []
    return children.length > 0 ? [{ ...topic, children }] : []
  })
}

function countTopics(topics: readonly GrammarTopic[]): number {
  return topics.reduce((count, topic) => count + 1 + countTopics(topic.children ?? []), 0)
}

function topicKey(topic: GrammarTopic): string {
  return `${topic.number}-${topic.de}`
}

function GroupTitle({ number, title, note }: { number: string; title: string; note?: string }) {
  return (
    <h2 className="flex min-w-0 flex-1 items-baseline gap-3 text-lg font-semibold text-[var(--ink)]">
      <span className="w-8 shrink-0 text-[var(--mute)] tabular-nums">{number}</span>
      <span className="min-w-0">
        {title}
        {note ? <span className="ml-2 font-normal text-[var(--mute)]">{note}</span> : null}
      </span>
    </h2>
  )
}

function ChapterTitle({ chapter }: { chapter: GrammarTopic }) {
  return <GroupTitle note={chapter.de} number={chapter.number ?? ''} title={chapter.zh} />
}

// A chapter in the list, closed until clicked. While filtering, `open` opens them all;
// `remountKey` changes with it, so they switch between opening by themselves and on a click.
function Group({
  children,
  open,
  remountKey,
  title,
}: {
  children: ReactNode
  open: boolean
  remountKey: string
  title: ReactNode
}) {
  return (
    <details className="group" key={remountKey} open={open || undefined}>
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-[var(--row-hover)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        {title}
        <svg
          aria-hidden="true"
          className="size-4 shrink-0 text-[var(--mute)] transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="pb-3">{children}</div>
    </details>
  )
}

function LevelTag({ level }: { level: string }) {
  return (
    <span className="rounded border border-[var(--line)] px-1.5 text-xs text-[var(--mute)] tabular-nums">
      {level}
    </span>
  )
}

// The topic open in the side panel, and how to open another.
interface OpenTopicProps {
  openNumber: string
  onOpen: (number: string) => void
}

// Only a numbered topic without sections under it has a page of its own.
function canOpen(topic: GrammarTopic): topic is GrammarTopic & { number: string } {
  return topic.number !== null && !topic.children
}

const rowClass =
  'grid min-h-9 w-full grid-cols-[4rem_minmax(0,1fr)_auto] items-baseline gap-x-3 rounded-md px-2 py-1.5 text-left transition-colors'

function TopicRow({ topic, openNumber, onOpen }: OpenTopicProps & { topic: GrammarTopic }) {
  const content = (
    <>
      <span className="text-sm text-[var(--mute)] tabular-nums">{topic.number}</span>
      <span className="min-w-0">
        <span className="text-sm font-semibold text-[var(--ink)]">{topic.zh}</span>
        <span className="ml-2 text-sm text-[var(--mute)]">{topic.de}</span>
      </span>
      {topic.level ? <LevelTag level={topic.level} /> : <span />}
    </>
  )

  if (!canOpen(topic)) return <div className={rowClass}>{content}</div>
  const selected = topic.number === openNumber
  return (
    <button
      aria-current={selected || undefined}
      className={`${rowClass} cursor-pointer hover:bg-[var(--row-hover)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none ${selected ? 'bg-[var(--row-hover)]' : ''}`}
      type="button"
      onClick={() => onOpen(topic.number)}
    >
      {content}
    </button>
  )
}

// A chapter's own text before its first section, opened like a topic under the chapter's number.
function IntroductionRow({
  label,
  number,
  openNumber,
  onOpen,
}: OpenTopicProps & { label: string; number: string }) {
  const selected = number === openNumber
  return (
    <button
      aria-current={selected || undefined}
      className={`${rowClass} cursor-pointer border-b border-[var(--line)] hover:bg-[var(--row-hover)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none ${selected ? 'bg-[var(--row-hover)]' : ''}`}
      type="button"
      onClick={() => onOpen(number)}
    >
      <span className="text-sm text-[var(--mute)] tabular-nums">{number}</span>
      <span className="text-sm font-semibold text-[var(--ink)]">{label}</span>
      <span />
    </button>
  )
}

// A section with text of its own before its first subsection gets an introduction row, like a
// chapter.
function TopicTree({
  introduction,
  topics,
  ...open
}: OpenTopicProps & {
  introduction: { label: string; numbers: ReadonlySet<string> }
  topics: readonly GrammarTopic[]
}) {
  return (
    <ul>
      {topics.map((topic) => (
        <li className="border-b border-[var(--line)] last:border-b-0" key={topicKey(topic)}>
          <TopicRow {...open} topic={topic} />
          {topic.children ? (
            <div className="mb-1 ml-[4.75rem] border-l border-[var(--line)] pl-2">
              {topic.number && introduction.numbers.has(topic.number) ? (
                <IntroductionRow {...open} label={introduction.label} number={topic.number} />
              ) : null}
              <TopicTree {...open} introduction={introduction} topics={topic.children} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function TopicCard({
  footer,
  heading,
  topic,
  openNumber,
  onOpen,
}: OpenTopicProps & {
  footer: string | null
  heading: string
  topic: GrammarTopic
}) {
  const selected = topic.number === openNumber
  const content = (
    <>
      <span className="truncate text-xs text-[var(--mute)] tabular-nums" title={heading}>
        {heading}
      </span>
      <span className="mt-1 text-lg font-semibold text-[var(--ink)]">{topic.zh}</span>
      {/* Always two lines tall, so every card has the same size. */}
      <span className="mt-1 line-clamp-2 min-h-10 text-sm text-[var(--mute)]" title={topic.de}>
        {topic.de}
      </span>
      <span className="mt-4 block min-h-4 text-xs font-semibold tracking-wide text-[var(--mute)] uppercase">
        {footer}
      </span>
    </>
  )
  const cardClass = `flex w-full flex-col rounded-xl border bg-[var(--card)] p-4 text-left ${selected ? 'border-[var(--root)]' : 'border-[var(--line)]'}`

  return (
    <li className="flex">
      {canOpen(topic) ? (
        <button
          aria-current={selected || undefined}
          className={`${cardClass} cursor-pointer hover:border-[var(--root)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none`}
          type="button"
          onClick={() => onOpen(topic.number)}
        >
          {content}
        </button>
      ) : (
        <div className={cardClass}>{content}</div>
      )}
    </li>
  )
}

export function GrammarDirectory({ contents, details, labels, language }: GrammarDirectoryProps) {
  const [selectedChapter, setSelectedChapter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<WordListView>('list')
  const subsectionCount = (count: number) =>
    `${count} ${count === 1 ? labels.subsection : labels.subsections}`
  // The topic open in the side panel, and a word opened from it, kept in the URL like the word
  // list's open word, so Back closes them and they can be shared.
  const search = new URLSearchParams(useSearchParamsString())
  const openNumber = search.get('topic') ?? ''
  const openWord = search.get('word') ?? ''
  const closeTopicPanel = useCallback(() => updateSearchParameter('topic', ''), [])
  const closeWordPanel = useCallback(() => updateSearchParameter('word', ''), [])
  const openTopic = useCallback(
    (number: string) => updateSearchParameters({ topic: number, word: '' }),
    [],
  )
  const open: OpenTopicProps = { openNumber, onOpen: openTopic }
  const introduction = { label: labels.introduction, numbers: new Set(Object.keys(details)) }
  // Like the word list's cards, fewer columns while the side panel takes room.
  const cardGridClass = `mt-3 grid gap-3 sm:grid-cols-2 ${openNumber || openWord ? '2xl:grid-cols-3' : 'lg:grid-cols-3'}`

  const key = searchKey(searchQuery)
  let shownChapters = contents.filter(
    (chapter) => !selectedChapter || chapter.number === selectedChapter,
  )
  if (key) {
    shownChapters = searchTopics(shownChapters, key)
  }
  // While filtering, every group opens by itself.
  const openAll = key !== '' || selectedChapter !== ''
  const remountKey = openAll ? `${key}|${selectedChapter}` : ''

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label={labels.chapter}
            options={[
              { value: '', label: labels.allChapters, count: countTopics(contents) },
              ...contents.map((chapter) => ({
                value: chapter.number ?? '',
                label: `${chapter.number} ${chapter.zh}`,
                hint: chapter.de,
                count: countTopics([chapter]),
              })),
            ]}
            value={selectedChapter}
            onChange={setSelectedChapter}
          />
          <label className="relative w-full sm:w-auto sm:max-w-64 sm:min-w-40 sm:flex-1">
            <span className="sr-only">{labels.search}</span>
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--mute)]"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--card)] pr-3.5 pl-9 text-sm text-[var(--ink)] transition-colors placeholder:text-[var(--mute)] hover:border-[var(--mute)] focus-visible:border-[var(--mute)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
              maxLength={100}
              placeholder={labels.searchPlaceholder}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
        </div>
        <ViewToggle labels={labels.views} view={view} onChange={setView} />
      </div>

      {shownChapters.length === 0 ? (
        <p className="mt-8 text-[var(--mute)]">{openAll ? labels.noMatches : labels.empty}</p>
      ) : view === 'cards' ? (
        <div className="mt-8 space-y-10">
          {shownChapters.map((chapter) => (
            <section key={topicKey(chapter)}>
              <ChapterTitle chapter={chapter} />
              <ul className={cardGridClass}>
                {/* A chapter without sections is a card of its own. */}
                {(chapter.children ?? [chapter]).map((topic) => (
                  <TopicCard
                    {...open}
                    footer={
                      topic.children
                        ? subsectionCount(topic.children.length)
                        : (topic.level ?? null)
                    }
                    heading={topic.number ?? ''}
                    key={topicKey(topic)}
                    topic={topic}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {shownChapters.map((chapter) =>
            chapter.children ? (
              <Group
                key={topicKey(chapter)}
                open={openAll}
                remountKey={`${topicKey(chapter)}-${remountKey}`}
                title={<ChapterTitle chapter={chapter} />}
              >
                {chapter.number && details[chapter.number] ? (
                  <IntroductionRow {...open} label={labels.introduction} number={chapter.number} />
                ) : null}
                <TopicTree {...open} introduction={introduction} topics={chapter.children} />
              </Group>
            ) : (
              <button
                aria-current={chapter.number === openNumber || undefined}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-[var(--row-hover)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none ${chapter.number === openNumber ? 'bg-[var(--row-hover)]' : ''}`}
                key={topicKey(chapter)}
                type="button"
                onClick={() => openTopic(chapter.number ?? '')}
              >
                <ChapterTitle chapter={chapter} />
                {chapter.level ? <LevelTag level={chapter.level} /> : null}
              </button>
            ),
          )}
        </div>
      )}

      {/* A word opened from the topic takes the panel's place; closing it goes back. */}
      {openWord ? (
        <WordDetailPanel
          labels={labels.wordPanel}
          language={language}
          slug={openWord}
          onClose={closeWordPanel}
        />
      ) : openNumber ? (
        <GrammarDetailPanel
          contents={contents}
          details={details}
          labels={labels.panel}
          language={language}
          number={openNumber}
          onClose={closeTopicPanel}
          onOpenTopic={openTopic}
        />
      ) : null}
    </div>
  )
}
