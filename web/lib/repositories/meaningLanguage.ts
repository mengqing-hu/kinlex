// Meanings are shown in the learner's language. English, which every word, sentence and word part
// has, stands in for each one not yet translated into it.
export const FALLBACK_MEANING_LANGUAGE = 'en'

// The languages to load meanings in: the learner's first, then the stand-in.
export function getMeaningLanguages(explainLanguage: string): string[] {
  return explainLanguage === FALLBACK_MEANING_LANGUAGE
    ? [FALLBACK_MEANING_LANGUAGE]
    : [explainLanguage, FALLBACK_MEANING_LANGUAGE]
}

interface Sense {
  gloss: string
  gloss_language: string
  sort_order: number
}

// A word's meanings in one language, never mixing translated and English ones.
export function pickGlosses(senses: Sense[], explainLanguage: string): string[] {
  const translated = senses.filter(({ gloss_language }) => gloss_language === explainLanguage)
  const chosen =
    translated.length > 0
      ? translated
      : senses.filter(({ gloss_language }) => gloss_language === FALLBACK_MEANING_LANGUAGE)
  return chosen
    .toSorted((left, right) => left.sort_order - right.sort_order)
    .map(({ gloss }) => gloss)
}

// The text in the learner's language if there is one, else the English one.
export function pickText<T extends { language: string }>(
  rows: T[],
  explainLanguage: string,
): T | undefined {
  return (
    rows.find(({ language }) => language === explainLanguage) ??
    rows.find(({ language }) => language === FALLBACK_MEANING_LANGUAGE)
  )
}

// A word part's meaning: English is stored on the word part, other languages in
// morpheme_meanings, loaded already narrowed to the learner's language.
export function pickMorphemeMeaning(
  englishMeaning: string,
  translations: { meaning: string }[],
): string {
  return translations[0]?.meaning ?? englishMeaning
}
