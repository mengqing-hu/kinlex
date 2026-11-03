import { fetchApiData } from '@/lib/client/apiClient'
import type { WordFamiliarity } from '@/types/domain'

const FAMILIARITY_KEY = 'kinlex:familiarity'
let remoteFamiliarityPromise: Promise<Map<number, number>> | null = null

function readLevels(): Map<number, number> {
  try {
    const value = JSON.parse(window.localStorage.getItem(FAMILIARITY_KEY) ?? '{}') as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) return new Map()
    return new Map(
      Object.entries(value).flatMap(([wordId, level]) => {
        const id = Number(wordId)
        return Number.isInteger(id) && id > 0 && Number.isInteger(level) && level >= 1 && level <= 5
          ? [[id, level as number]]
          : []
      }),
    )
  } catch {
    return new Map()
  }
}

function writeLevels(levels: Map<number, number>): void {
  try {
    window.localStorage.setItem(FAMILIARITY_KEY, JSON.stringify(Object.fromEntries(levels)))
  } catch {
    // Storage can be unavailable in private windows; the level then lasts only for this page.
  }
}

export const getLocalFamiliarity = (wordId: number): number => readLevels().get(wordId) ?? 0

export function setLocalFamiliarity(wordId: number, level: number): void {
  const levels = readLevels()
  if (level > 0) levels.set(wordId, level)
  else levels.delete(wordId)
  writeLevels(levels)
}

export async function mergeLocalFamiliarity(): Promise<boolean> {
  const entries = [...readLevels()].map(([wordId, level]) => ({ wordId, level }))
  if (entries.length === 0) return false

  const response = await fetch('/api/v1/me/familiarity/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  })
  if (response.ok) {
    window.localStorage.removeItem(FAMILIARITY_KEY)
    remoteFamiliarityPromise = null
    return true
  }
  return false
}

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
