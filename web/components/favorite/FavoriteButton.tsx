'use client'

import { useEffect, useState } from 'react'

import { SignInPrompt } from '@/components/auth/SignInPrompt'
import { queueActivityEvent } from '@/lib/client/eventQueue'
import { getRemoteFavoriteIds, updateRemoteFavorite } from '@/lib/client/favorites'
import { getBrowserSupabase } from '@/lib/supabase/browser'

interface FavoriteButtonProps {
  initialFavorited: boolean
  language: string
  wordId: number
  /** 'sm' for panels, 'xs' for dense list rows. */
  size?: 'xs' | 'sm' | 'md'
}

const buttonSizes = { xs: 'size-6', sm: 'size-7', md: 'size-9' }
const iconSizes = { xs: 'size-3.5', sm: 'size-4', md: 'size-5' }

export function FavoriteButton({
  initialFavorited,
  language,
  wordId,
  size = 'md',
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited)
  // Unknown until the session has loaded; the button does nothing until then.
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
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

    queueActivityEvent({
      language,
      eventType: next ? 'favorite' : 'unfavorite',
      targetType: 'word',
      targetId: wordId,
      value: null,
    })
  }

  const button = (
    <button
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={favorited}
      className={`inline-flex ${buttonSizes[size]} items-center justify-center rounded-full text-[var(--suffix)] hover:bg-[var(--bg)] disabled:opacity-50`}
      disabled={pending}
      type="button"
      onClick={signedIn ? () => void toggle() : undefined}
    >
      <svg aria-hidden="true" className={iconSizes[size]} viewBox="0 0 24 24">
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

  return signedIn === false ? (
    <SignInPrompt message="Sign in to save favorites">{button}</SignInPrompt>
  ) : (
    button
  )
}
