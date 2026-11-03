import type { NextRequest } from 'next/server'

import { AppError } from '@/lib/errors'
import { privateErrorResponse, privateResponse } from '@/lib/http'
import { requireUser } from '@/lib/services/authService'
import { mergeUserFamiliarities } from '@/lib/services/familiarityService'
import { getSupabase } from '@/lib/supabase/server'
import { formatValidationError } from '@/lib/validation/common'
import { familiarityMergeSchema } from '@/lib/validation/me'

export async function POST(request: NextRequest) {
  const parsed = familiarityMergeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return privateErrorResponse('INVALID_PARAMS', formatValidationError(parsed.error), 400)
  }
  try {
    const db = await getSupabase()
    const user = await requireUser(db)
    await mergeUserFamiliarities(db, user.id, parsed.data.entries)
    return privateResponse({ merged: parsed.data.entries.length })
  } catch (error) {
    if (error instanceof AppError)
      return privateErrorResponse(error.code, error.message, error.status)
    console.error('Failed to merge familiarity', error)
    return privateErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
  }
}
