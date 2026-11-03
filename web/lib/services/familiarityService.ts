import type { SupabaseClient } from '@supabase/supabase-js'

import { findFamiliarities, setFamiliarities } from '@/lib/repositories/familiarityRepository'
import type { Database } from '@/types/db'
import type { WordFamiliarity } from '@/types/domain'

export const listFamiliarities = (db: SupabaseClient<Database>, userId: string) =>
  findFamiliarities(db, userId)

export const updateFamiliarity = (
  db: SupabaseClient<Database>,
  userId: string,
  wordId: number,
  level: number,
) => setFamiliarities(db, userId, [{ wordId, level }])

export const mergeUserFamiliarities = (
  db: SupabaseClient<Database>,
  userId: string,
  entries: WordFamiliarity[],
) => setFamiliarities(db, userId, entries)
