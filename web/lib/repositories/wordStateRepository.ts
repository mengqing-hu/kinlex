import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { RepositoryError } from '@/lib/errors'
import type { Database } from '@/types/db'

export type ResettableWordState = 'familiarity' | 'favorites'

function assertQuerySucceeded(error: PostgrestError | null, operation: string): void {
  if (error) throw new RepositoryError(`Failed to ${operation}`, { cause: error })
}

// Clears one kind of the user's word state on the given words; returns the ids that changed.
export async function resetWordState(
  db: SupabaseClient<Database>,
  field: ResettableWordState,
  wordIds: number[],
): Promise<number[]> {
  if (wordIds.length === 0) return []
  const { data, error } = await db.rpc('reset_word_state', {
    p_field: field,
    p_word_ids: wordIds,
  })
  assertQuerySucceeded(error, `reset ${field}`)
  return data ?? []
}
