'use client'

import { useEffect } from 'react'

import { queueActivityEvent } from '@/lib/client/eventQueue'

const HEARTBEAT_SECONDS = 30

export function ActivityHeartbeat() {
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      queueActivityEvent({
        language: 'de',
        eventType: 'study_heartbeat',
        targetType: null,
        targetId: null,
        value: HEARTBEAT_SECONDS,
      })
    }, HEARTBEAT_SECONDS * 1000)

    return () => window.clearInterval(interval)
  }, [])

  return null
}
