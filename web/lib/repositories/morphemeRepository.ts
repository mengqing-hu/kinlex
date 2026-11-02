import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { RepositoryError } from '@/lib/errors'
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
): Promise<MorphemeWordCollection | null> {
  const { data: morpheme, error: morphemeError } = await db
    .from('morphemes')
    .select('id, slug, text, type, meaning, separable')
    .eq('id', morphemeId)
    .eq('language', language)
    .maybeSingle()

  assertQuerySucceeded(morphemeError, 'load morpheme')
  if (!morpheme) {
    return null
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
    .select('id, slug, lemma, pos, gender, level')
    .eq('language', language)
    .in('id', wordIds)
    .order('freq_rank', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(8)

  assertQuerySucceeded(wordsError, 'load morpheme words')
  return { morpheme, words: words ?? [] }
}

export async function findMorphemeDirectory(
  db: SupabaseClient<Database>,
  language: string,
): Promise<MorphemeDirectoryItem[]> {
  const [morphemesResult, relationsResult] = await Promise.all([
    db
      .from('morphemes')
      .select('id, slug, text, type, meaning, separable')
      .eq('language', language)
      .order('type', { ascending: true })
      .order('text', { ascending: true }),
    db
      .from('word_morphemes')
      .select('morpheme_id, words!inner(language)')
      .not('morpheme_id', 'is', null)
      .eq('words.language', language),
  ])

  assertQuerySucceeded(morphemesResult.error, 'load morpheme directory')
  assertQuerySucceeded(relationsResult.error, 'count morpheme words')

  const wordCountByMorphemeId = new Map<number, number>()
  for (const relation of relationsResult.data ?? []) {
    if (relation.morpheme_id !== null) {
      wordCountByMorphemeId.set(
        relation.morpheme_id,
        (wordCountByMorphemeId.get(relation.morpheme_id) ?? 0) + 1,
      )
    }
  }

  return (morphemesResult.data ?? []).map((morpheme) => ({
    ...morpheme,
    wordCount: wordCountByMorphemeId.get(morpheme.id) ?? 0,
  }))
}
