import type { SupabaseClient } from '@supabase/supabase-js'

import { findFamiliarities, setFamiliarities } from '@/lib/repositories/familiarityRepository'
import type { Database } from '@/types/db'

export const listFamiliarities = (db: SupabaseClient<Database>, userId: string) =>
  findFamiliarities(db, userId)

export const updateFamiliarity = (
  db: SupabaseClient<Database>,
  userId: string,
  wordId: number,
  level: number,
) => setFamiliarities(db, userId, [{ wordId, level }])
