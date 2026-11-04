import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { RepositoryError } from '@/lib/errors'
import type { Database } from '@/types/db'
import type { FavoriteWord } from '@/types/domain'

function assertQuerySucceeded(error: PostgrestError | null, operation: string): void {
  if (error) throw new RepositoryError(`Failed to ${operation}`, { cause: error })
}

export async function findFavorites(
  db: SupabaseClient<Database>,
  userId: string,
): Promise<FavoriteWord[]> {
  const { data, error } = await db
    .from('user_word_state')
    .select(
      'words!inner(id, slug, lemma:word, pos:word_class, posDetail:word_class_detail, gender, level, freq_rank)',
    )
    .eq('user_id', userId)
    .eq('favorited', true)
  assertQuerySucceeded(error, 'load favorites')

  return (data ?? [])
    .map(({ words }) => words)
    .toSorted(
      (left, right) =>
        (left.freq_rank ?? Number.MAX_SAFE_INTEGER) -
          (right.freq_rank ?? Number.MAX_SAFE_INTEGER) ||
        left.lemma.localeCompare(right.lemma, 'de'),
    )
    .map((word) => ({
      id: word.id,
      slug: word.slug,
      lemma: word.lemma,
      pos: word.pos,
      posDetail: word.posDetail,
      gender: word.gender,
      level: word.level,
    }))
}

export async function setFavorite(
  db: SupabaseClient<Database>,
  userId: string,
  wordId: number,
  favorited: boolean,
): Promise<void> {
  const { error } = await db
    .from('user_word_state')
    .upsert({ user_id: userId, word_id: wordId, favorited }, { onConflict: 'user_id,word_id' })
  assertQuerySucceeded(error, favorited ? 'favorite word' : 'remove favorite')
}

export async function mergeFavorites(
  db: SupabaseClient<Database>,
  userId: string,
  wordIds: number[],
): Promise<void> {
  if (wordIds.length === 0) return
  const { error } = await db.from('user_word_state').upsert(
    wordIds.map((wordId) => ({ user_id: userId, word_id: wordId, favorited: true })),
    { onConflict: 'user_id,word_id' },
  )
  assertQuerySucceeded(error, 'merge favorites')
}
