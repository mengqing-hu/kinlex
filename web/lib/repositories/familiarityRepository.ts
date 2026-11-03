import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { RepositoryError } from '@/lib/errors'
import type { Database } from '@/types/db'
import type { WordFamiliarity } from '@/types/domain'

function assertQuerySucceeded(error: PostgrestError | null, operation: string): void {
  if (error) throw new RepositoryError(`Failed to ${operation}`, { cause: error })
}

export async function findFamiliarities(
  db: SupabaseClient<Database>,
  userId: string,
): Promise<WordFamiliarity[]> {
  const { data, error } = await db
    .from('user_word_state')
    .select('wordId:word_id, level:familiarity')
    .eq('user_id', userId)
    .gt('familiarity', 0)
  assertQuerySucceeded(error, 'load familiarity')
  return data ?? []
}

export async function setFamiliarities(
  db: SupabaseClient<Database>,
  userId: string,
  entries: WordFamiliarity[],
): Promise<void> {
  if (entries.length === 0) return
  const { error } = await db.from('user_word_state').upsert(
    entries.map(({ wordId, level }) => ({ user_id: userId, word_id: wordId, familiarity: level })),
    { onConflict: 'user_id,word_id' },
  )
  assertQuerySucceeded(error, 'update familiarity')
}
