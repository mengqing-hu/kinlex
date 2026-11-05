'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/HoverCard'
import { fetchApiData } from '@/lib/client/apiClient'
import { openWordPanelOnClick } from '@/lib/client/searchParams'
import { getWordPanelPath } from '@/lib/wordPanel'
import type { MorphemeWordCollection } from '@/types/domain'

export interface MorphemeCardLabels {
  loading: string
  loadError: string
  retry: string
  relatedWords: string
  noRelatedWords: string
  separable: string
  morphemeTypes: Record<string, string>
  partsOfSpeech: Record<string, string>
}

interface MorphemeCardProps {
  children: ReactNode
  language: string
  morphemeId: number
  labels: MorphemeCardLabels
}

type CardState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; data: MorphemeWordCollection }
  | { status: 'error' }

const morphemeRequestCache = new Map<string, Promise<MorphemeWordCollection>>()

function requestMorphemeWords(language: string, morphemeId: number) {
  const cacheKey = `${language}:${morphemeId}`
  const cachedRequest = morphemeRequestCache.get(cacheKey)

  if (cachedRequest) {
    return cachedRequest
  }

  const request = fetchApiData<MorphemeWordCollection>(
    `/api/v1/morphemes/${morphemeId}/words?lang=${encodeURIComponent(language)}`,
  ).catch((error: unknown) => {
    morphemeRequestCache.delete(cacheKey)
    throw error
  })

  morphemeRequestCache.set(cacheKey, request)
  return request
}

export function MorphemeCard({ children, language, morphemeId, labels }: MorphemeCardProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<CardState>({ status: 'idle' })

  function load() {
    if (state.status === 'loading' || state.status === 'loaded') {
      return
    }

    setState({ status: 'loading' })
    void requestMorphemeWords(language, morphemeId)
      .then((data) => setState({ status: 'loaded', data }))
      .catch(() => setState({ status: 'error' }))
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)

    if (nextOpen) {
      load()
    }
  }

  return (
    <HoverCard open={open} openDelay={150} closeDelay={150} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>
        <button
          className="font-inherit cursor-help border-0 bg-transparent p-0 text-inherit"
          type="button"
          onClick={() => handleOpenChange(!open)}
        >
          {children}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start">
        {state.status === 'idle' || state.status === 'loading' ? (
          <p className="text-sm text-[var(--mute)]" role="status">
            {labels.loading}
          </p>
        ) : state.status === 'error' ? (
          <div>
            <p className="text-sm text-[var(--mute)]">{labels.loadError}</p>
            <button
              className="mt-3 rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-semibold hover:border-[var(--info)]"
              type="button"
              onClick={load}
            >
              {labels.retry}
            </button>
          </div>
        ) : (
          <div>
            <p className="flex items-baseline gap-2">
              <span className="text-base font-semibold">{state.data.morpheme.text}</span>
              <span className="text-[11px] font-semibold tracking-wide text-[var(--mute)] uppercase">
                {labels.morphemeTypes[state.data.morpheme.type] ?? state.data.morpheme.type}
                {state.data.morpheme.separable ? `, ${labels.separable}` : ''}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-[var(--mute)]">{state.data.morpheme.meaning}</p>

            <p className="mt-3 border-t border-[var(--line)] pt-3 text-[11px] font-semibold tracking-wide text-[var(--mute)] uppercase">
              {labels.relatedWords}
            </p>
            {state.data.words.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {state.data.words.map((word) => (
                  <li key={word.id}>
                    <Link
                      className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1 text-sm hover:bg-[var(--bg)] focus-visible:outline-2 focus-visible:outline-[var(--info)]"
                      href={getWordPanelPath(language, word.slug, word.level)}
                      onClick={(event) => openWordPanelOnClick(event, word.slug)}
                      prefetch={false}
                    >
                      <span className="shrink-0 font-medium">
                        {word.segments.length > 0
                          ? word.segments.map((segment, index) =>
                              segment.morphemeId === morphemeId ? (
                                <span
                                  className="rounded-sm bg-[var(--highlight)] px-0.5"
                                  key={`${index}-${segment.surface}`}
                                >
                                  {segment.surface}
                                </span>
                              ) : (
                                <span key={`${index}-${segment.surface}`}>{segment.surface}</span>
                              ),
                            )
                          : word.lemma}
                      </span>
                      <span className="text-right text-xs text-[var(--mute)]">
                        {word.glosses.join(', ')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[var(--mute)]">{labels.noRelatedWords}</p>
            )}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
