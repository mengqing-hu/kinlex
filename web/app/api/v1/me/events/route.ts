import type { NextRequest } from 'next/server'

import { AppError } from '@/lib/errors'
import { privateErrorResponse, privateResponse } from '@/lib/http'
import { requireUser } from '@/lib/services/authService'
import { recordActivityEvents } from '@/lib/services/eventService'
import { getSupabase } from '@/lib/supabase/server'
import { formatValidationError } from '@/lib/validation/common'
import { activityBatchSchema } from '@/lib/validation/me'

export async function POST(request: NextRequest) {
  const parsed = activityBatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return privateErrorResponse('INVALID_PARAMS', formatValidationError(parsed.error), 400)
  }
  try {
    const db = await getSupabase()
    const user = await requireUser(db)
    return privateResponse(await recordActivityEvents(db, user.id, parsed.data.events))
  } catch (error) {
    if (error instanceof AppError)
      return privateErrorResponse(error.code, error.message, error.status)
    console.error('Failed to record activity', error)
    return privateErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
  }
}
