export const partOfSpeechPrefixes: Record<string, string[]> = {
  adjective: ['adjective', 'adjektiv'],
  adverb: ['adverb'],
  article: ['article', 'artikel'],
  conjunction: ['conjunction', 'konjunktion'],
  expression: ['expression', 'ausdruck'],
  interjection: ['interjection', 'interjektion'],
  noun: ['noun', 'nomen'],
  numeral: ['numeral', 'numerale'],
  particle: ['particle', 'partikel'],
  preposition: ['preposition', 'präposition'],
  pronoun: ['pronoun', 'pronomen'],
  verb: ['verb'],
}

/** The translated word class plus the source detail in German, e.g. "Verb (Modalverb)". */
export function formatPartOfSpeech(
  labels: Record<string, string>,
  pos: string,
  detail: string | null,
): string {
  const label = labels[pos] ?? pos
  return detail ? `${label} (${detail})` : label
}

export function normalizePartOfSpeech(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('de')
  for (const [partOfSpeech, prefixes] of Object.entries(partOfSpeechPrefixes)) {
    if (prefixes.some((prefix) => normalized.startsWith(prefix))) {
      return partOfSpeech
    }
  }
  return normalized
}
