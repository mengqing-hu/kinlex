import type { SupabaseClient } from '@supabase/supabase-js'

import { resetWordState, type ResettableWordState } from '@/lib/repositories/wordStateRepository'
import type { Database } from '@/types/db'

export const resetUserWordState = (
  db: SupabaseClient<Database>,
  field: ResettableWordState,
  wordIds: number[],
) => resetWordState(db, field, wordIds)
