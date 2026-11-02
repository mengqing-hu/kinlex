import { AppError } from '@/lib/errors'
import { privateErrorResponse, privateResponse } from '@/lib/http'
import { requireUser } from '@/lib/services/authService'
import { getUserStatistics } from '@/lib/services/statsService'
import { getSupabase } from '@/lib/supabase/server'

export async function GET() {
  try {
    const db = await getSupabase()
    const user = await requireUser(db)
    return privateResponse(await getUserStatistics(db, user.id))
  } catch (error) {
    if (error instanceof AppError)
      return privateErrorResponse(error.code, error.message, error.status)
    console.error('Failed to load statistics', error)
    return privateErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
  }
}
