import { fetchApiData } from '@/lib/client/apiClient'
import { updateRemoteFamiliarity } from '@/lib/client/familiarity'
import { updateRemoteFavorite } from '@/lib/client/favorites'

export type ResettableWordState = 'familiarity' | 'favorites'

export type MarkedWordIds = Record<ResettableWordState, number[]>

const fetchWordIds = (listParams: URLSearchParams) =>
  fetchApiData<{ wordIds: number[] }>(`/api/v1/words/ids?${listParams}`, {
    cache: 'no-store',
  }).then(({ wordIds }) => wordIds)

// The words of a list (given by its filters) that have a familiarity or are a favorite. Only an
// account can mark words, so a guest has none.
export async function findMarkedWordIds(
  listParams: URLSearchParams,
  signedIn: boolean,
): Promise<MarkedWordIds> {
  if (!signedIn) return { familiarity: [], favorites: [] }

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

// Clears the familiarity or the favorite mark of these words in the account. Returns the ids that
// changed.
export async function resetWordState(
  field: ResettableWordState,
  wordIds: number[],
): Promise<number[]> {
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
