'use client'

import { useEffect } from 'react'

import { queueActivityEvent } from '@/lib/client/eventQueue'

// Views sort the word list, so one opening must count once even when the panel mounts twice in a
// row (as React's strict mode does in development).
const REPEAT_WINDOW_MS = 300
let lastView: { wordId: number; at: number } | null = null

export function WordViewTracker({ language, wordId }: { language: string; wordId: number }) {
  useEffect(() => {
    const now = Date.now()
    if (lastView && lastView.wordId === wordId && now - lastView.at < REPEAT_WINDOW_MS) return
    lastView = { wordId, at: now }

    queueActivityEvent({
      language,
      eventType: 'view_word',
      targetType: 'word',
      targetId: wordId,
      value: null,
    })
  }, [language, wordId])

  return null
}
