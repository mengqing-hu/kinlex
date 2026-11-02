import { AppError } from '@/lib/errors'
import { privateErrorResponse, privateResponse } from '@/lib/http'
import { requireUser } from '@/lib/services/authService'
import { getSupabase } from '@/lib/supabase/server'

export async function DELETE() {
  try {
    const db = await getSupabase()
    await requireUser(db)
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
