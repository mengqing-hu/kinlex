import type { SupabaseClient } from '@supabase/supabase-js'

import { findUserStatistics } from '@/lib/repositories/statsRepository'
import type { Database } from '@/types/db'

export const getUserStatistics = (db: SupabaseClient<Database>, userId: string) =>
  findUserStatistics(db, userId)
