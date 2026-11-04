import { fetchApiData } from '@/lib/client/apiClient'
import {
  clearLocalFamiliarity,
  getLocalFamiliarityIds,
  updateRemoteFamiliarity,
} from '@/lib/client/localFamiliarity'
import {
  clearLocalFavorites,
  getLocalFavoriteIds,
  updateRemoteFavorite,
} from '@/lib/client/localFavorites'

export type ResettableWordState = 'familiarity' | 'favorites'

export type MarkedWordIds = Record<ResettableWordState, number[]>

const fetchWordIds = (listParams: URLSearchParams) =>
  fetchApiData<{ wordIds: number[] }>(`/api/v1/words/ids?${listParams}`, {
    cache: 'no-store',
  }).then(({ wordIds }) => wordIds)

// The words of a list (given by its filters) that have a familiarity or are a favorite, in the
// account when signed in and in this browser otherwise.
export async function findMarkedWordIds(
  listParams: URLSearchParams,
  signedIn: boolean,
): Promise<MarkedWordIds> {
  if (signedIn) {
    const markedIds = (marked: ResettableWordState) => {
      const params = new URLSearchParams(listParams)
      params.set('marked', marked)
      return fetchWordIds(params)
    }
    const [familiarity, favorites] = await Promise.all([
      markedIds('familiarity'),
      markedIds('favorites'),
    ])
    return { familiarity, favorites }
  }

  const listed = new Set(await fetchWordIds(listParams))
  return {
    familiarity: getLocalFamiliarityIds().filter((wordId) => listed.has(wordId)),
    favorites: getLocalFavoriteIds().filter((wordId) => listed.has(wordId)),
  }
}

// Clears the familiarity or the favorite mark of these words, in the account when signed in and
// in this browser otherwise. Returns the ids that changed.
export async function resetWordState(
  field: ResettableWordState,
  wordIds: number[],
  signedIn: boolean,
): Promise<number[]> {
  if (!signedIn) {
    return field === 'familiarity' ? clearLocalFamiliarity(wordIds) : clearLocalFavorites(wordIds)
  }

  const { wordIds: changed } = await fetchApiData<{ wordIds: number[] }>('/api/v1/me/words/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field, wordIds }),
  })
  for (const wordId of changed) {
    if (field === 'familiarity') updateRemoteFamiliarity(wordId, 0)
    else updateRemoteFavorite(wordId, false)
  }
  return changed
}
