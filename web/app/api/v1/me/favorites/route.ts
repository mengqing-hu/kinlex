import { AppError } from '@/lib/errors'
import { privateErrorResponse, privateResponse } from '@/lib/http'
import { requireUser } from '@/lib/services/authService'
import { listFavorites } from '@/lib/services/favoriteService'
import { getSupabase } from '@/lib/supabase/server'

export async function GET() {
  try {
    const db = await getSupabase()
    const user = await requireUser(db)
    return privateResponse(await listFavorites(db, user.id))
  } catch (error) {
    if (error instanceof AppError)
      return privateErrorResponse(error.code, error.message, error.status)
    console.error('Failed to list favorites', error)
    return privateErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
  }
}
