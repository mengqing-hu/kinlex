import type { NextRequest } from 'next/server'

import { AppError } from '@/lib/errors'
import { contentErrorResponse, contentResponse, privateResponse } from '@/lib/http'
import { listAllWordIds } from '@/lib/services/wordService'
import { getSupabase } from '@/lib/supabase/server'
import { formatValidationError } from '@/lib/validation/common'
import { wordIdsParamsSchema } from '@/lib/validation/words'

// The ids of every word a word list's filters match, for actions on the whole list.
export async function GET(request: NextRequest) {
  const parsedParams = wordIdsParamsSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  )

  if (!parsedParams.success) {
    return contentErrorResponse('INVALID_PARAMS', formatValidationError(parsedParams.error), 400)
  }

  try {
    const db = await getSupabase()
    const {
      data: { user },
    } = await db.auth.getUser()
    const wordIds = await listAllWordIds(db, parsedParams.data, user?.id)

    // A favorites list depends on who asks, so it must not land in a shared cache.
    return user ? privateResponse({ wordIds }) : contentResponse({ wordIds })
  } catch (error) {
    if (error instanceof AppError) {
      return contentErrorResponse(error.code, error.message, error.status)
    }

    console.error('Failed to list word ids', error)
    return contentErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
  }
}
