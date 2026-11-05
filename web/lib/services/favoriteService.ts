import type { SupabaseClient } from '@supabase/supabase-js'

import { findFavorites, setFavorite } from '@/lib/repositories/favoriteRepository'
import type { Database } from '@/types/db'

export const listFavorites = (db: SupabaseClient<Database>, userId: string) =>
  findFavorites(db, userId)

export const updateFavorite = (
  db: SupabaseClient<Database>,
  userId: string,
  wordId: number,
  favorited: boolean,
) => setFavorite(db, userId, wordId, favorited)
