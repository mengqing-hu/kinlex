'use client'

import { useEffect } from 'react'

import { flushEventQueue } from '@/lib/client/eventQueue'

export function AccountSync() {
  useEffect(() => {
    void flushEventQueue()
  }, [])
  return null
}
