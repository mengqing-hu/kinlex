'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/HoverCard'
import { fetchApiData } from '@/lib/client/apiClient'
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">{state.data.morpheme.text}</p>
                <p className="mt-1 text-xs font-semibold tracking-wide text-[var(--mute)] uppercase">
                  {labels.morphemeTypes[state.data.morpheme.type] ?? state.data.morpheme.type}
                  {state.data.morpheme.separable ? `, ${labels.separable}` : ''}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--mute)]">
              {state.data.morpheme.meaning}
            </p>

            <p className="mt-4 border-t border-[var(--line)] pt-3 text-xs font-semibold tracking-wide text-[var(--mute)] uppercase">
              {labels.relatedWords}
            </p>
            {state.data.words.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {state.data.words.map((word) => (
                  <li key={word.id}>
                    <Link
                      className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-[var(--bg)] focus-visible:outline-2 focus-visible:outline-[var(--info)]"
                      href={`/${encodeURIComponent(language)}/word/${encodeURIComponent(word.slug)}`}
                    >
                      <span className="font-medium">
                        {word.gender ? `${word.gender} ` : ''}
                        {word.lemma}
                      </span>
                      <span className="text-xs text-[var(--mute)]">
                        {labels.partsOfSpeech[word.pos] ?? word.pos}
                        {word.level ? `, ${word.level}` : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--mute)]">{labels.noRelatedWords}</p>
            )}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
