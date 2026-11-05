import { fetchApiData } from '@/lib/client/apiClient'
import type { WordFamiliarity } from '@/types/domain'

let remoteFamiliarityPromise: Promise<Map<number, number>> | null = null

export function getRemoteFamiliarity(): Promise<Map<number, number>> {
  remoteFamiliarityPromise ??= fetchApiData<WordFamiliarity[]>('/api/v1/me/familiarity', {
    cache: 'no-store',
  }).then((entries) => new Map(entries.map(({ wordId, level }) => [wordId, level])))
  return remoteFamiliarityPromise
}

export function updateRemoteFamiliarity(wordId: number, level: number): void {
  if (!remoteFamiliarityPromise) return
  void remoteFamiliarityPromise.then((levels) => {
    if (level > 0) levels.set(wordId, level)
    else levels.delete(wordId)
  })
}
