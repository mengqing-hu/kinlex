import type { NextRequest } from 'next/server'

import { AppError } from '@/lib/errors'
import { privateErrorResponse, privateResponse } from '@/lib/http'
import { requireUser } from '@/lib/services/authService'
import { reviewFlashcard } from '@/lib/services/flashcardService'
import { getSupabase } from '@/lib/supabase/server'
import { formatValidationError } from '@/lib/validation/common'
import { favoriteWordIdSchema, flashcardReviewSchema } from '@/lib/validation/me'

interface FlashcardRouteContext {
  params: Promise<{ wordId: string }>
}

export async function PUT(request: NextRequest, context: FlashcardRouteContext) {
  const { wordId } = await context.params
  const parsedId = favoriteWordIdSchema.safeParse(wordId)
  if (!parsedId.success) {
    return privateErrorResponse('INVALID_PARAMS', formatValidationError(parsedId.error), 400)
  }
  const parsedBody = flashcardReviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsedBody.success) {
    return privateErrorResponse('INVALID_PARAMS', formatValidationError(parsedBody.error), 400)
  }
  try {
    const db = await getSupabase()
    await requireUser(db)
    await reviewFlashcard(db, parsedId.data, parsedBody.data.result)
    return privateResponse({ result: parsedBody.data.result })
  } catch (error) {
    if (error instanceof AppError)
      return privateErrorResponse(error.code, error.message, error.status)
    console.error('Failed to record flashcard review', error)
    return privateErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
  }
}
