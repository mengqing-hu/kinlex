import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { RepositoryError } from '@/lib/errors'
import { withArticle, withArticlePart } from '@/lib/repositories/article'
import { pickGlosses, pickMorphemeMeaning } from '@/lib/repositories/meaningLanguage'
import type { Database } from '@/types/db'
import type { MorphemeDirectoryItem, MorphemeWordCollection } from '@/types/domain'

function assertQuerySucceeded(error: PostgrestError | null, operation: string): void {
  if (error) {
    throw new RepositoryError(`Failed to ${operation}`, { cause: error })
  }
}

export async function findMorphemeWords(
  db: SupabaseClient<Database>,
  morphemeId: number,
  language: string,
  explainLanguage: string,
  limit: number,
): Promise<MorphemeWordCollection | null> {
  const { data: morphemeRow, error: morphemeError } = await db
    .from('morphemes')
    .select(
      'id, slug, text:morpheme, spellings, type:morpheme_type, meaning:morpheme_meaning, separable:is_separable, morpheme_meanings(meaning)',
    )
    .eq('id', morphemeId)
    .eq('language', language)
    .eq('morpheme_meanings.meaning_language', explainLanguage)
    .maybeSingle()

  assertQuerySucceeded(morphemeError, 'load morpheme')
  if (!morphemeRow) {
    return null
  }
  const { morpheme_meanings, ...morphemeFields } = morphemeRow
  const morpheme = {
    ...morphemeFields,
    spellings: morphemeRow.spellings ?? [],
    meaning: pickMorphemeMeaning(morphemeRow.meaning, morpheme_meanings),
  }

  const { data: relations, error: relationsError } = await db
    .from('word_morphemes')
    .select('word_id')
    .eq('morpheme_id', morphemeId)

  assertQuerySucceeded(relationsError, 'load morpheme word relationships')
  const wordIds = [...new Set((relations ?? []).map(({ word_id }) => word_id))]

  if (wordIds.length === 0) {
    return { morpheme, words: [] }
  }

  const { data: words, error: wordsError } = await db
    .from('words')
    .select(
      'id, slug, lemma:word, article, pos:word_class, posDetail:word_class_detail, gender, level, word_morphemes(position, surface:word_part, morpheme_id, morphemes(type:morpheme_type)), senses(gloss:word_meaning, gloss_language:meaning_language, sort_order)',
    )
    .eq('language', language)
    .in('id', wordIds)
    .order('freq_rank', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(limit)

  assertQuerySucceeded(wordsError, 'load morpheme words')
  return {
    morpheme,
    words: (words ?? []).map(({ senses, word_morphemes, article, ...word }) => ({
      ...word,
      lemma: withArticle(word.lemma, article),
      segments: withArticlePart(
        word_morphemes
          .toSorted((left, right) => left.position - right.position)
          .map((segment) => ({
            surface: segment.surface,
            morphemeId: segment.morpheme_id,
            type: segment.morphemes?.type ?? null,
          })),
        article,
        (surface) => ({ surface, morphemeId: null, type: null }),
      ),
      glosses: pickGlosses(senses, explainLanguage),
    })),
  }
}

// PostgREST returns at most this many rows per request (max_rows in supabase/config.toml), and a
// language has several thousand word parts, so the directory is read page by page.
const DIRECTORY_PAGE_SIZE = 1000

export async function findMorphemeDirectory(
  db: SupabaseClient<Database>,
  language: string,
  explainLanguage: string,
): Promise<MorphemeDirectoryItem[]> {
  const items: MorphemeDirectoryItem[] = []
  for (let from = 0; ; from += DIRECTORY_PAGE_SIZE) {
    const { data, error } = await db
      .from('morphemes')
      .select(
        'id, slug, text:morpheme, spellings, type:morpheme_type, meaning:morpheme_meaning, separable:is_separable, morpheme_meanings(meaning), word_morphemes(count)',
      )
      .eq('language', language)
      .eq('morpheme_meanings.meaning_language', explainLanguage)
      .order('morpheme_type', { ascending: true })
      .order('morpheme', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + DIRECTORY_PAGE_SIZE - 1)

    assertQuerySucceeded(error, 'load morpheme directory')
    for (const { morpheme_meanings, word_morphemes, ...morpheme } of data ?? []) {
      const wordCount = word_morphemes[0]?.count ?? 0
      // A word part no word uses any more, left behind when words were segmented again.
      if (wordCount === 0) continue
      items.push({
        ...morpheme,
        spellings: morpheme.spellings ?? [],
        meaning: pickMorphemeMeaning(morpheme.meaning, morpheme_meanings),
        wordCount,
      })
    }
    if ((data?.length ?? 0) < DIRECTORY_PAGE_SIZE) return items
  }
}
