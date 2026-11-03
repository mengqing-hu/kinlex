import type { NextRequest } from 'next/server'

import { AppError } from '@/lib/errors'
import { privateErrorResponse, privateResponse } from '@/lib/http'
import { requireUser } from '@/lib/services/authService'
import { updateFamiliarity } from '@/lib/services/familiarityService'
import { getSupabase } from '@/lib/supabase/server'
import { formatValidationError } from '@/lib/validation/common'
import { favoriteWordIdSchema, familiarityUpdateSchema } from '@/lib/validation/me'

interface FamiliarityRouteContext {
  params: Promise<{ wordId: string }>
}

export async function PUT(request: NextRequest, context: FamiliarityRouteContext) {
  const { wordId } = await context.params
  const parsedId = favoriteWordIdSchema.safeParse(wordId)
  if (!parsedId.success) {
    return privateErrorResponse('INVALID_PARAMS', formatValidationError(parsedId.error), 400)
  }
  const parsedBody = familiarityUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsedBody.success) {
    return privateErrorResponse('INVALID_PARAMS', formatValidationError(parsedBody.error), 400)
  }
  try {
    const db = await getSupabase()
    const user = await requireUser(db)
    await updateFamiliarity(db, user.id, parsedId.data, parsedBody.data.level)
    return privateResponse({ level: parsedBody.data.level })
  } catch (error) {
    if (error instanceof AppError)
      return privateErrorResponse(error.code, error.message, error.status)
    console.error('Failed to update familiarity', error)
    return privateErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
  }
}
