'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { flushEventQueue } from '@/lib/client/eventQueue'
import { mergeLocalFamiliarity } from '@/lib/client/localFamiliarity'
import { mergeLocalFavorites } from '@/lib/client/localFavorites'

export function AccountSync() {
  const router = useRouter()
  useEffect(() => {
    void Promise.all([mergeLocalFavorites(), mergeLocalFamiliarity()]).then((merged) => {
      if (merged.some(Boolean)) router.refresh()
    })
    void flushEventQueue()
  }, [router])
  return null
}
