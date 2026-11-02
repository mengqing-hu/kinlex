export function normalizeSearchQuery(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ')
}
