'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'

import { fetchApiData } from '@/lib/client/apiClient'
import { formatPartOfSpeech } from '@/lib/utils/partOfSpeech'
import type { StudyLine } from '@/lib/videos/types'
import type { SearchResult } from '@/types/domain'

export interface WordSearchLabels {
  searchWords: string
  noMatches: string
  searchHint: string
  inThisVideo: string
  inVocabulary: string
  similarSpelling: string
  partsOfSpeech: Record<string, string>
}

const SEARCH_DELAY_MS = 250
const RESULT_LIMIT = 20

interface SearchState {
  query: string
  items: SearchResult[]
  error: boolean
}

// The vocabulary words matching a query, looked up a moment after typing stops. Null while the
// query is empty or its answer has not come back yet.
export function useWordSearch(
  language: string,
  explainLanguage: string,
  query: string,
): { items: SearchResult[]; error: boolean } | null {
  const trimmed = query.trim()
  const [state, setState] = useState<SearchState>({ query: '', items: [], error: false })

  useEffect(() => {
    if (!trimmed) return
    const controller = new AbortController()
    const params = new URLSearchParams({
      lang: language,
      q: trimmed,
      explain: explainLanguage,
      limit: String(RESULT_LIMIT),
    })
    const timer = window.setTimeout(() => {
      void fetchApiData<{ items: SearchResult[] }>(`/api/v1/search?${params}`, {
        signal: controller.signal,
      })
        .then(({ items }) => setState({ query: trimmed, items, error: false }))
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === 'AbortError') return
          setState({ query: trimmed, items: [], error: true })
        })
    }, SEARCH_DELAY_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [language, explainLanguage, trimmed])

  return trimmed && state.query === trimmed ? state : null
}

// The right column swaps panels as a word opens or closes, which mounts the box anew; focus
// keeps typing in it, with the caret after the text.
export function WordSearchBox({
  value,
  label,
  focus = false,
  onChange,
}: {
  value: string
  label: string
  focus?: boolean
  onChange: (value: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = inputRef.current
    if (!focus || !input) return
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }, [focus])

  return (
    <div className="shrink-0 border-b border-[var(--line)] p-3">
      <label className="relative block">
        <span className="sr-only">{label}</span>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--mute)]"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
        <input
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] py-2 pr-3 pl-9 text-sm text-[var(--ink)] placeholder:text-[var(--mute)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
          placeholder={label}
          ref={inputRef}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  )
}

// A spelling compared without case or accents: "sofa" finds sofá.
function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
}

// A word of the video's captions spelled like the query, with the entry it belongs to.
export interface VideoMatch {
  line: number
  token: number
  surface: string
  lemma: string
  gloss: string | null
}

const VIDEO_MATCH_LIMIT = 5
// Below this many letters, words that only look alike are mostly noise (soy and sol).
const MIN_SIMILAR_LENGTH = 4

// The first place each entry appears in the captions in the spelling searched for: soy is ser.
export function findVideoMatches(lines: StudyLine[], query: string): VideoMatch[] {
  const wanted = plain(query.trim())
  if (!wanted) return []
  const matches: VideoMatch[] = []
  const seen = new Set<string>()
  lines.forEach((line, lineIndex) => {
    line.tokens.forEach((token, tokenIndex) => {
      const key = token.slug ?? token.lemma
      if (matches.length >= VIDEO_MATCH_LIMIT || seen.has(key) || plain(token.surface) !== wanted) {
        return
      }
      seen.add(key)
      matches.push({
        line: lineIndex,
        token: tokenIndex,
        surface: token.surface,
        lemma: token.lemma,
        gloss: token.gloss,
      })
    })
  })
  return matches
}

function ResultButton({
  title,
  meta,
  detail,
  onClick,
}: {
  title: string
  meta: string
  detail: string | null
  onClick: () => void
}) {
  return (
    <li>
      <button
        className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--row-hover)]"
        type="button"
        onClick={onClick}
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold text-[var(--ink)]">{title}</span>
          <span className="shrink-0 text-xs text-[var(--mute)]">{meta}</span>
        </span>
        {detail ? (
          <span className="block truncate text-sm text-[var(--mute)]">{detail}</span>
        ) : null}
      </button>
    </li>
  )
}

function ResultGroup({ heading, children }: { heading: string | null; children: ReactNode }) {
  return (
    <section className="p-2">
      {heading ? (
        <h3 className="px-3 pt-1 pb-1.5 text-xs font-bold tracking-[0.08em] text-[var(--mute)] uppercase">
          {heading}
        </h3>
      ) : null}
      <ul className="space-y-0.5">{children}</ul>
    </section>
  )
}

// Words of the video first, then entries whose spelling contains the query. Entries that only
// look alike are shown, under their own heading, when nothing contains a longer query.
export function WordSearchResults({
  query,
  search,
  videoMatches,
  labels,
  onPick,
  onPickVideoMatch,
}: {
  query: string
  search: { items: SearchResult[]; error: boolean } | null
  videoMatches: VideoMatch[]
  labels: WordSearchLabels
  onPick: (slug: string) => void
  onPickVideoMatch: (match: VideoMatch) => void
}) {
  const wanted = plain(query.trim())
  if (!wanted) {
    return <p className="px-4 py-8 text-center text-sm text-[var(--mute)]">{labels.searchHint}</p>
  }

  const items = search?.items ?? []
  const containing = items.filter((item) => plain(item.lemma).includes(wanted))
  const similar =
    containing.length === 0 && wanted.length >= MIN_SIMILAR_LENGTH
      ? items.filter((item) => !containing.includes(item))
      : []
  if (search && videoMatches.length === 0 && containing.length === 0 && similar.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-[var(--mute)]">{labels.noMatches}</p>
  }

  const renderItem = (item: SearchResult) => (
    <ResultButton
      detail={item.gloss}
      key={item.id}
      meta={[formatPartOfSpeech(labels.partsOfSpeech, item.pos, item.posDetail), item.level]
        .filter(Boolean)
        .join(' · ')}
      title={item.lemma}
      onClick={() => onPick(item.slug)}
    />
  )

  return (
    <>
      {videoMatches.length > 0 ? (
        <ResultGroup heading={labels.inThisVideo}>
          {videoMatches.map((match) => (
            <ResultButton
              detail={match.gloss}
              key={`${match.line}-${match.token}`}
              meta=""
              title={
                match.surface === match.lemma ? match.lemma : `${match.surface} → ${match.lemma}`
              }
              onClick={() => onPickVideoMatch(match)}
            />
          ))}
        </ResultGroup>
      ) : null}
      {containing.length > 0 ? (
        <ResultGroup heading={videoMatches.length > 0 ? labels.inVocabulary : null}>
          {containing.map(renderItem)}
        </ResultGroup>
      ) : null}
      {similar.length > 0 ? (
        <ResultGroup heading={labels.similarSpelling}>{similar.map(renderItem)}</ResultGroup>
      ) : null}
    </>
  )
}
