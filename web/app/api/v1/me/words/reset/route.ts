import type { NextRequest } from 'next/server'

import { AppError } from '@/lib/errors'
import { privateErrorResponse, privateResponse } from '@/lib/http'
import { requireUser } from '@/lib/services/authService'
import { resetUserWordState } from '@/lib/services/wordStateService'
import { getSupabase } from '@/lib/supabase/server'
import { formatValidationError } from '@/lib/validation/common'
import { wordStateResetSchema } from '@/lib/validation/me'

export async function POST(request: NextRequest) {
  const parsed = wordStateResetSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return privateErrorResponse('INVALID_PARAMS', formatValidationError(parsed.error), 400)
  }
  try {
    const db = await getSupabase()
    await requireUser(db)
    const wordIds = await resetUserWordState(db, parsed.data.field, parsed.data.wordIds)
    return privateResponse({ wordIds })
  } catch (error) {
    if (error instanceof AppError)
      return privateErrorResponse(error.code, error.message, error.status)
    console.error('Failed to reset word state', error)
    return privateErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
  }
}
