import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError, RepositoryError } from '@/lib/errors'
import type { FlashcardDeckParams, FlashcardResult } from '@/lib/validation/me'
import type { Database } from '@/types/db'

function assertQuerySucceeded(error: PostgrestError | null, operation: string): void {
  if (error) throw new RepositoryError(`Failed to ${operation}`, { cause: error })
}

export async function drawFlashcardWordIds(
  db: SupabaseClient<Database>,
  params: FlashcardDeckParams,
): Promise<number[]> {
  const { data, error } = await db.rpc('flashcard_deck', {
    p_language: params.lang,
    p_limit: params.limit,
    p_source: params.source,
    p_levels: params.levels,
  })
  assertQuerySucceeded(error, 'draw flashcards')
  return data ?? []
}

export async function recordFlashcardReview(
  db: SupabaseClient<Database>,
  wordId: number,
  result: FlashcardResult,
): Promise<void> {
  const { error } = await db.rpc('record_flashcard_review', {
    p_word_id: wordId,
    p_result: result,
  })
  // P0002 is raised when the word does not exist or is not published.
  if (error?.code === 'P0002') throw new NotFoundError('Word not found')
  assertQuerySucceeded(error, 'record flashcard review')
}
