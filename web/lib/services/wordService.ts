import type { SupabaseClient } from '@supabase/supabase-js'

import { InvalidParamsError, NotFoundError, UnsupportedLanguageError } from '@/lib/errors'
import { isSupportedLanguage } from '@/lib/languages'
import { findWordBySlug, findWordFilterOptions, findWords } from '@/lib/repositories/wordRepository'
import { decodeWordCursor } from '@/lib/utils/cursor'
import type { WordDetailParams, WordListParams } from '@/lib/validation/words'
import type { Database } from '@/types/db'
import type { CursorPage, WordDetail, WordFilterOptions, WordListItem } from '@/types/domain'

export async function listWords(
  db: SupabaseClient<Database>,
  params: WordListParams,
  userId?: string,
): Promise<CursorPage<WordListItem>> {
  if (!isSupportedLanguage(params.lang)) {
    throw new UnsupportedLanguageError(params.lang)
  }

  const decodedCursor = params.cursor ? (decodeWordCursor(params.cursor) ?? undefined) : undefined
  if (params.cursor && !decodedCursor) {
    throw new InvalidParamsError('cursor is invalid')
  }
  // Familiarity is per user, so the sort only applies when someone is signed in.
  const sort = userId ? params.sort : undefined
  if (decodedCursor && (sort !== undefined) !== (decodedCursor.familiarity !== undefined)) {
    throw new InvalidParamsError('cursor does not match the sort order')
  }

  return findWords(db, { ...params, sort, decodedCursor }, userId)
}

export async function listWordFilterOptions(
  db: SupabaseClient<Database>,
  language: string,
): Promise<WordFilterOptions> {
  if (!isSupportedLanguage(language)) {
    throw new UnsupportedLanguageError(language)
  }

  return findWordFilterOptions(db, language)
}

export type GetWordDetailResult =
  { kind: 'found'; word: WordDetail } | { kind: 'redirect'; slug: string }

export async function getWordDetail(
  db: SupabaseClient<Database>,
  slug: string,
  params: WordDetailParams,
  userId?: string,
): Promise<GetWordDetailResult> {
  if (!isSupportedLanguage(params.lang)) {
    throw new UnsupportedLanguageError(params.lang)
  }

  const result = await findWordBySlug(db, params.lang, slug, params.explain, userId)
  if (result.kind === 'notFound') {
    throw new NotFoundError('Word not found')
  }

  return result
}
