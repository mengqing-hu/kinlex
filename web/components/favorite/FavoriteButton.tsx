'use client'

import { useEffect, useState } from 'react'

import { queueActivityEvent } from '@/lib/client/eventQueue'
import {
  getRemoteFavoriteIds,
  isLocalFavorite,
  setLocalFavorite,
  updateRemoteFavorite,
} from '@/lib/client/localFavorites'
import { getBrowserSupabase } from '@/lib/supabase/browser'

interface FavoriteButtonProps {
  initialFavorited: boolean
  language: string
  wordId: number
  /** Compact sizing for dense list rows. */
  small?: boolean
}

export function FavoriteButton({
  initialFavorited,
  language,
  wordId,
  small = false,
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited)
  const [signedIn, setSignedIn] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    void Promise.resolve(isLocalFavorite(wordId)).then((localFavorite) => {
      if (localFavorite) setFavorited(true)
    })
    void getBrowserSupabase()
      .auth.getSession()
      .then(({ data }) => {
        const hasSession = Boolean(data.session)
        setSignedIn(hasSession)
        if (hasSession) {
          void getRemoteFavoriteIds().then((ids) => setFavorited(ids.has(wordId)))
        }
      })
  }, [wordId])

  async function toggle() {
    const next = !favorited
    setFavorited(next)

    if (!signedIn) {
      setLocalFavorite(wordId, next)
    } else {
      setPending(true)
      const response = await fetch(`/api/v1/me/favorites/${wordId}`, {
        method: next ? 'PUT' : 'DELETE',
      })
      setPending(false)
      if (!response.ok) {
        setFavorited(!next)
        return
      }
      updateRemoteFavorite(wordId, next)
    }

    queueActivityEvent({
      language,
      eventType: next ? 'favorite' : 'unfavorite',
      targetType: 'word',
      targetId: wordId,
      value: null,
    })
  }

  return (
    <button
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={favorited}
      className={`inline-flex ${small ? 'size-7' : 'size-9'} items-center justify-center rounded-full text-[var(--suffix)] hover:bg-[var(--bg)] disabled:opacity-50`}
      disabled={pending}
      type="button"
      onClick={() => void toggle()}
    >
      <svg aria-hidden="true" className={small ? 'size-4' : 'size-5'} viewBox="0 0 24 24">
        <path
          d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"
          fill={favorited ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    </button>
  )
}
