import type { SupabaseClient } from '@supabase/supabase-js'

import { defaultSortOrders, personalWordSorts } from '@/lib/constants'
import { InvalidParamsError, NotFoundError, UnsupportedLanguageError } from '@/lib/errors'
import { isSupportedLanguage } from '@/lib/languages'
import {
  findAllWordIds,
  findWordBySlug,
  findWordFilterOptions,
  findWords,
} from '@/lib/repositories/wordRepository'
import { decodeWordCursor } from '@/lib/utils/cursor'
import type { WordDetailParams, WordIdsParams, WordListParams } from '@/lib/validation/words'
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

  // Sorts by what one learner did only apply when someone is signed in; guests get the default.
  const allowed = params.sort && (userId || !personalWordSorts.includes(params.sort))
  const sort = allowed && params.sort ? params.sort : 'frequency'
  const order = (allowed ? params.order : undefined) ?? defaultSortOrders[sort]
  // Topics are filtered in the database's sorting function, so a topic always pages through it.
  const ordering =
    sort === 'frequency' && order === 'asc' && !params.topic
      ? undefined
      : { sort, descending: order === 'desc' }
  if (decodedCursor && (ordering !== undefined) !== 'offset' in decodedCursor) {
    throw new InvalidParamsError('cursor does not match the sort order')
  }

  return findWords(db, { ...params, decodedCursor, ordering }, userId)
}

export async function listAllWordIds(
  db: SupabaseClient<Database>,
  params: WordIdsParams,
  userId?: string,
): Promise<number[]> {
  if (!isSupportedLanguage(params.lang)) {
    throw new UnsupportedLanguageError(params.lang)
  }

  return findAllWordIds(db, params, userId)
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
