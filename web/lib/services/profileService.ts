import type { SupabaseClient } from '@supabase/supabase-js'

import { InvalidParamsError } from '@/lib/errors'
import { findProfile, removeAvatarFiles, updateProfile } from '@/lib/repositories/profileRepository'
import type { ProfileUpdate } from '@/lib/validation/me'
import type { Database } from '@/types/db'

export const getProfile = (db: SupabaseClient<Database>, userId: string) => findProfile(db, userId)

export async function saveProfile(
  db: SupabaseClient<Database>,
  userId: string,
  update: ProfileUpdate,
) {
  if (update.avatarPath && !update.avatarPath.startsWith(`${userId}/`)) {
    throw new InvalidParamsError('The avatar must be in your own folder')
  }

  const profile = await updateProfile(db, userId, update)
  if (update.avatarPath !== undefined) {
    await removeAvatarFiles(db, userId, profile.avatarPath)
  }
  return profile
}

export const removeAllAvatarFiles = (db: SupabaseClient<Database>, userId: string) =>
  removeAvatarFiles(db, userId)
