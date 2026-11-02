export interface WordCursor {
  freqRank: number | null
  id: number
}

function isWordCursor(value: unknown): value is WordCursor {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  const validRank =
    candidate.freqRank === null ||
    (typeof candidate.freqRank === 'number' &&
      Number.isInteger(candidate.freqRank) &&
      candidate.freqRank > 0)

  return (
    validRank &&
    typeof candidate.id === 'number' &&
    Number.isInteger(candidate.id) &&
    candidate.id > 0
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
