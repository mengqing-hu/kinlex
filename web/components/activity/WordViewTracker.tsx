'use client'

import { useEffect } from 'react'

import { queueActivityEvent } from '@/lib/client/eventQueue'

export function WordViewTracker({ language, wordId }: { language: string; wordId: number }) {
  useEffect(() => {
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
