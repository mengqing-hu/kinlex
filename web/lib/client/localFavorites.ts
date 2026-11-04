import { fetchApiData } from '@/lib/client/apiClient'
import type { FavoriteWord } from '@/types/domain'

const FAVORITES_KEY = 'kinlex:favorites'
let remoteFavoriteIdsPromise: Promise<Set<number>> | null = null

function readIds(): number[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? '[]') as unknown
    return Array.isArray(value)
      ? value.filter((item): item is number => Number.isInteger(item) && item > 0)
      : []
  } catch {
    return []
  }
}

export const getLocalFavoriteIds = (): number[] => readIds()

export function isLocalFavorite(wordId: number): boolean {
  return readIds().includes(wordId)
}

export function setLocalFavorite(wordId: number, favorited: boolean): void {
  const ids = new Set(readIds())
  if (favorited) ids.add(wordId)
  else ids.delete(wordId)
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]))
}

export async function mergeLocalFavorites(): Promise<boolean> {
  const wordIds = readIds()
  if (wordIds.length === 0) return false

  const response = await fetch('/api/v1/me/favorites/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wordIds }),
  })
  if (response.ok) {
    window.localStorage.removeItem(FAVORITES_KEY)
    remoteFavoriteIdsPromise = null
    return true
  }
  return false
}

export function getRemoteFavoriteIds(): Promise<Set<number>> {
  remoteFavoriteIdsPromise ??= fetchApiData<FavoriteWord[]>('/api/v1/me/favorites', {
    cache: 'no-store',
  }).then((words) => new Set(words.map((word) => word.id)))
  return remoteFavoriteIdsPromise
}

export function updateRemoteFavorite(wordId: number, favorited: boolean): void {
  if (!remoteFavoriteIdsPromise) return
  void remoteFavoriteIdsPromise.then((ids) => {
    if (favorited) ids.add(wordId)
    else ids.delete(wordId)
  })
}

// Removes these words from the favorites kept in this browser; returns the ids that were there.
export function clearLocalFavorites(wordIds: number[]): number[] {
  const ids = new Set(readIds())
  const cleared = wordIds.filter((wordId) => ids.delete(wordId))
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]))
  return cleared
}
