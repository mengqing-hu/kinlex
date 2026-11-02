import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { RepositoryError } from '@/lib/errors'
import type { Database } from '@/types/db'
import type { SearchResult } from '@/types/domain'

function assertQuerySucceeded(error: PostgrestError | null, operation: string): void {
  if (error) throw new RepositoryError(`Failed to ${operation}`, { cause: error })
}

export async function findSearchResults(
  db: SupabaseClient<Database>,
  language: string,
  query: string,
  limit: number,
): Promise<SearchResult[]> {
  const { data: matches, error: matchError } = await db.rpc('search_words_fuzzy', {
    p_language: language,
    p_query: query,
    p_limit: limit,
  })
  assertQuerySucceeded(matchError, 'search words')

  const wordIds = (matches ?? []).map((word) => word.id)
  if (wordIds.length === 0) return []

  const { data: words, error: wordsError } = await db
    .from('words')
    .select('id, slug, lemma, pos, gender, level, senses(gloss, gloss_language, sort_order)')
    .in('id', wordIds)
  assertQuerySucceeded(wordsError, 'load search results')

  const wordsById = new Map((words ?? []).map((word) => [word.id, word]))
  return wordIds.flatMap<SearchResult>((wordId) => {
    const word = wordsById.get(wordId)
    if (!word) return []

    const gloss = word.senses
      .filter((sense) => sense.gloss_language === 'en')
      .toSorted((left, right) => left.sort_order - right.sort_order)[0]?.gloss

    return [{ ...word, senses: undefined, gloss: gloss ?? null }]
  })
}
