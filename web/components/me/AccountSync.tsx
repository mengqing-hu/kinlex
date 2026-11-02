'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { flushEventQueue } from '@/lib/client/eventQueue'
import { mergeLocalFavorites } from '@/lib/client/localFavorites'

export function AccountSync() {
  const router = useRouter()
  useEffect(() => {
    void mergeLocalFavorites().then((merged) => {
      if (merged) router.refresh()
    })
    void flushEventQueue()
  }, [router])
  return null
}
