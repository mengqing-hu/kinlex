import { fetchApiData } from '@/lib/client/apiClient'
import type { FavoriteWord } from '@/types/domain'

let remoteFavoriteIdsPromise: Promise<Set<number>> | null = null

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
