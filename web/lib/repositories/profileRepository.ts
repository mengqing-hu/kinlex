import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { RepositoryError } from '@/lib/errors'
import type { ProfileUpdate } from '@/lib/validation/me'
import type { Database } from '@/types/db'
import type { UserProfile } from '@/types/domain'

export const AVATAR_BUCKET = 'avatars'

function assertQuerySucceeded(error: PostgrestError | null, operation: string): void {
  if (error) throw new RepositoryError(`Failed to ${operation}`, { cause: error })
}

function mapProfile(
  db: SupabaseClient<Database>,
  profile: Database['public']['Tables']['profiles']['Row'],
): UserProfile {
  return {
    displayName: profile.display_name,
    avatarPath: profile.avatar_path,
    avatarUrl: profile.avatar_path
      ? db.storage.from(AVATAR_BUCKET).getPublicUrl(profile.avatar_path).data.publicUrl
      : null,
    nativeLanguage: profile.native_language,
    uiLanguage: profile.ui_language,
    timezone: profile.timezone,
    profilePublic: profile.profile_public,
  }
}

export async function findProfile(
  db: SupabaseClient<Database>,
  userId: string,
): Promise<UserProfile> {
  const { data, error } = await db.from('profiles').select('*').eq('user_id', userId).single()
  assertQuerySucceeded(error, 'load profile')
  if (!data) throw new RepositoryError('Failed to load profile')
  return mapProfile(db, data)
}

export async function updateProfile(
  db: SupabaseClient<Database>,
  userId: string,
  update: ProfileUpdate,
): Promise<UserProfile> {
  const { data, error } = await db
    .from('profiles')
    .update({
      display_name: update.displayName,
      avatar_path: update.avatarPath,
      native_language: update.nativeLanguage,
      ui_language: update.uiLanguage,
      timezone: update.timezone,
      profile_public: update.profilePublic,
    })
    .eq('user_id', userId)
    .select('*')
    .single()
  assertQuerySucceeded(error, 'update profile')
  if (!data) throw new RepositoryError('Failed to update profile')
  return mapProfile(db, data)
}

// Removes every file in the user's avatar folder except the one to keep, so a replaced or removed
// picture does not stay behind.
export async function removeAvatarFiles(
  db: SupabaseClient<Database>,
  userId: string,
  keepPath: string | null = null,
): Promise<void> {
  const bucket = db.storage.from(AVATAR_BUCKET)
  const { data, error } = await bucket.list(userId)
  if (error) throw new RepositoryError('Failed to list avatar files', { cause: error })
  const paths = (data ?? [])
    .map((file) => `${userId}/${file.name}`)
    .filter((path) => path !== keepPath)
  if (paths.length === 0) return
  const { error: removeError } = await bucket.remove(paths)
  if (removeError)
    throw new RepositoryError('Failed to remove avatar files', { cause: removeError })
}
