import type { SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError, UnsupportedLanguageError } from '@/lib/errors'
import { isSupportedLanguage } from '@/lib/languages'
import { findMorphemeWords } from '@/lib/repositories/morphemeRepository'
import type { Database } from '@/types/db'
import { findMorphemeDirectory } from '@/lib/repositories/morphemeRepository'
import type { MorphemeDirectoryItem, MorphemeWordCollection } from '@/types/domain'

export async function getMorphemeWords(
  db: SupabaseClient<Database>,
  morphemeId: number,
  language: string,
): Promise<MorphemeWordCollection> {
  if (!isSupportedLanguage(language)) {
    throw new UnsupportedLanguageError(language)
  }

  const result = await findMorphemeWords(db, morphemeId, language)
  if (!result) {
    throw new NotFoundError('Morpheme not found')
  }

  return result
}

export async function listMorphemes(
  db: SupabaseClient<Database>,
  language: string,
): Promise<MorphemeDirectoryItem[]> {
  if (!isSupportedLanguage(language)) {
    throw new UnsupportedLanguageError(language)
  }

  return findMorphemeDirectory(db, language)
}

export async function getMorphemeBySlug(
  db: SupabaseClient<Database>,
  language: string,
  slug: string,
): Promise<MorphemeDirectoryItem> {
  const morphemes = await listMorphemes(db, language)
  const morpheme = morphemes.find((candidate) => candidate.slug === slug)

  if (!morpheme) {
    throw new NotFoundError('Morpheme not found')
  }

  return morpheme
}
