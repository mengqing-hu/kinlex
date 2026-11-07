import type { SupabaseClient } from '@supabase/supabase-js'

import { UnsupportedLanguageError } from '@/lib/errors'
import { isSupportedLanguage } from '@/lib/languages'
import { findSearchResults } from '@/lib/repositories/searchRepository'
import { normalizeSearchQuery } from '@/lib/utils/normalize'
import type { Database } from '@/types/db'
import type { SearchResult } from '@/types/domain'

export async function searchWords(
  db: SupabaseClient<Database>,
  language: string,
  rawQuery: string,
  explainLanguage: string,
  limit: number,
): Promise<{ query: string; items: SearchResult[] }> {
  if (!isSupportedLanguage(language)) throw new UnsupportedLanguageError(language)

  const query = normalizeSearchQuery(rawQuery)
  return { query, items: await findSearchResults(db, language, query, explainLanguage, limit) }
}
