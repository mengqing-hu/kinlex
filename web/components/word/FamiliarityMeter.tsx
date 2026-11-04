'use client'

import { useEffect, useState } from 'react'

import {
  getLocalFamiliarity,
  getRemoteFamiliarity,
  setLocalFamiliarity,
  updateRemoteFamiliarity,
} from '@/lib/client/localFamiliarity'
import { getBrowserSupabase } from '@/lib/supabase/browser'

interface FamiliarityMeterProps {
  wordId: number
  /** Accessible label, with `{level}` replaced by the current level (0-5). */
  label: string
}

const MAX_LEVEL = 5

// The ring and number take the colour of the level, running from red (new) to green (known).
const levelClasses: Record<number, string> = {
  1: 'border-[var(--familiarity-1)] text-[var(--familiarity-1)]',
  2: 'border-[var(--familiarity-2)] text-[var(--familiarity-2)]',
  3: 'border-[var(--familiarity-3)] text-[var(--familiarity-3)]',
  4: 'border-[var(--familiarity-4)] text-[var(--familiarity-4)]',
  5: 'border-[var(--familiarity-5)] text-[var(--familiarity-5)]',
}

export function FamiliarityMeter({ wordId, label }: FamiliarityMeterProps) {
  const [level, setLevel] = useState(0)
  const [signedIn, setSignedIn] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    void Promise.resolve(getLocalFamiliarity(wordId)).then(setLevel)
    void getBrowserSupabase()
      .auth.getSession()
      .then(({ data }) => {
        const hasSession = Boolean(data.session)
        setSignedIn(hasSession)
        if (hasSession) {
          void getRemoteFamiliarity()
            .then((levels) => setLevel(levels.get(wordId) ?? 0))
            .catch(() => undefined)
        }
      })
  }, [wordId])

  async function cycle() {
    // Each click raises the level by one; clicking at the top level clears it.
    const previous = level
    const next = (level + 1) % (MAX_LEVEL + 1)
    setLevel(next)

    if (!signedIn) {
      setLocalFamiliarity(wordId, next)
      return
    }

    setPending(true)
    const response = await fetch(`/api/v1/me/familiarity/${wordId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: next }),
    }).catch(() => null)
    setPending(false)
    if (!response?.ok) {
      setLevel(previous)
      return
    }
    updateRemoteFamiliarity(wordId, next)
  }

  const levelLabel = label.replace('{level}', String(level))

  return (
    <button
      aria-label={levelLabel}
      className={`flex size-4 items-center justify-center rounded-full border text-[10px] leading-none font-semibold tabular-nums transition-colors disabled:cursor-wait ${
        level > 0
          ? levelClasses[level]
          : 'border-dashed border-[var(--mute)] text-[var(--mute)] hover:border-[var(--ink)] hover:text-[var(--ink)]'
      }`}
      disabled={pending}
      title={levelLabel}
      type="button"
      onClick={() => void cycle()}
    >
      {level > 0 ? level : ''}
    </button>
  )
}
