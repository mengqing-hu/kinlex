// The default order pages by the last word's frequency rank and id; every other sort pages by how
// many words came before.
export type WordCursor = { freqRank: number | null; id: number } | { offset: number }

const isPositiveInteger = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

function isWordCursor(value: unknown): value is WordCursor {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  if ('offset' in candidate) {
    return isPositiveInteger(candidate.offset)
  }

  return (
    (candidate.freqRank === null || isPositiveInteger(candidate.freqRank)) &&
    isPositiveInteger(candidate.id)
  )
}

export function encodeWordCursor(cursor: WordCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

export function decodeWordCursor(value: string): WordCursor | null {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    return isWordCursor(decoded) ? decoded : null
  } catch {
    return null
  }
}
