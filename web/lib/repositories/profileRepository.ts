import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { RepositoryError } from '@/lib/errors'
import type { ProfileUpdate } from '@/lib/validation/me'
import type { Database } from '@/types/db'
import type { UserProfile } from '@/types/domain'

function assertQuerySucceeded(error: PostgrestError | null, operation: string): void {
  if (error) throw new RepositoryError(`Failed to ${operation}`, { cause: error })
}

function mapProfile(profile: Database['public']['Tables']['profiles']['Row']): UserProfile {
  return {
    displayName: profile.display_name,
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
  return mapProfile(data)
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
  return mapProfile(data)
}
