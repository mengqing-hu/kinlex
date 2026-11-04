import type { NextRequest } from 'next/server'

import { AppError } from '@/lib/errors'
import { privateErrorResponse, privateResponse } from '@/lib/http'
import { requireUser } from '@/lib/services/authService'
import { drawFlashcards } from '@/lib/services/flashcardService'
import { getSupabase } from '@/lib/supabase/server'
import { formatValidationError } from '@/lib/validation/common'
import { flashcardDeckParamsSchema } from '@/lib/validation/me'

export async function GET(request: NextRequest) {
  const parsedParams = flashcardDeckParamsSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  )
  if (!parsedParams.success) {
    return privateErrorResponse('INVALID_PARAMS', formatValidationError(parsedParams.error), 400)
  }
  try {
    const db = await getSupabase()
    const user = await requireUser(db)
    return privateResponse(await drawFlashcards(db, parsedParams.data, user.id))
  } catch (error) {
    if (error instanceof AppError)
      return privateErrorResponse(error.code, error.message, error.status)
    console.error('Failed to draw flashcards', error)
    return privateErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
  }
}
