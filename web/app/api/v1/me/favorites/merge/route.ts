import type { NextRequest } from 'next/server'

import { AppError } from '@/lib/errors'
import { privateErrorResponse, privateResponse } from '@/lib/http'
import { requireUser } from '@/lib/services/authService'
import { mergeUserFavorites } from '@/lib/services/favoriteService'
import { getSupabase } from '@/lib/supabase/server'
import { formatValidationError } from '@/lib/validation/common'
import { favoriteMergeSchema } from '@/lib/validation/me'

export async function POST(request: NextRequest) {
  const parsed = favoriteMergeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return privateErrorResponse('INVALID_PARAMS', formatValidationError(parsed.error), 400)
  }
  try {
    const db = await getSupabase()
    const user = await requireUser(db)
    await mergeUserFavorites(db, user.id, parsed.data.wordIds)
    return privateResponse({ merged: parsed.data.wordIds.length })
  } catch (error) {
    if (error instanceof AppError)
      return privateErrorResponse(error.code, error.message, error.status)
    console.error('Failed to merge favorites', error)
    return privateErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
  }
}
