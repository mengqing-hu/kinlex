import { AppError } from '@/lib/errors'
import { privateErrorResponse, privateResponse } from '@/lib/http'
import { requireUser } from '@/lib/services/authService'
import { removeAllAvatarFiles } from '@/lib/services/profileService'
import { getSupabase } from '@/lib/supabase/server'

export async function DELETE() {
  try {
    const db = await getSupabase()
    const user = await requireUser(db)
    // Storage files are not tied to the account, so they would outlive it. A file left behind is
    // better than an account that cannot be deleted, so a failure here does not stop the deletion.
    await removeAllAvatarFiles(db, user.id).catch((error: unknown) =>
      console.error('Failed to remove avatar files', error),
    )
    const { error } = await db.rpc('delete_current_user')
    if (error) throw error
    return privateResponse({ deleted: true })
  } catch (error) {
    if (error instanceof AppError)
      return privateErrorResponse(error.code, error.message, error.status)
    console.error('Failed to delete account', error)
    return privateErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
  }
}
