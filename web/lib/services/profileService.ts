import type { SupabaseClient } from '@supabase/supabase-js'

import { findProfile, updateProfile } from '@/lib/repositories/profileRepository'
import type { ProfileUpdate } from '@/lib/validation/me'
import type { Database } from '@/types/db'

export const getProfile = (db: SupabaseClient<Database>, userId: string) => findProfile(db, userId)

export const saveProfile = (db: SupabaseClient<Database>, userId: string, update: ProfileUpdate) =>
  updateProfile(db, userId, update)
