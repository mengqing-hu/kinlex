import type { SupabaseClient } from '@supabase/supabase-js'

import { UnsupportedLanguageError } from '@/lib/errors'
import { isSupportedLanguage } from '@/lib/languages'
import { drawFlashcardWordIds, recordFlashcardReview } from '@/lib/repositories/flashcardRepository'
import { findWordsByIds } from '@/lib/repositories/wordRepository'
import type { FlashcardDeckParams, FlashcardResult } from '@/lib/validation/me'
import type { Database } from '@/types/db'
import type { WordListItem } from '@/types/domain'

export async function drawFlashcards(
  db: SupabaseClient<Database>,
  params: FlashcardDeckParams,
  userId: string,
): Promise<WordListItem[]> {
  if (!isSupportedLanguage(params.lang)) {
    throw new UnsupportedLanguageError(params.lang)
  }

  const wordIds = await drawFlashcardWordIds(db, params)
  return findWordsByIds(db, params.lang, params.explain, wordIds, userId)
}

export const reviewFlashcard = (
  db: SupabaseClient<Database>,
  wordId: number,
  result: FlashcardResult,
) => recordFlashcardReview(db, wordId, result)
