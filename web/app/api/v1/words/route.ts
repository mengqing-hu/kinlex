import type { NextRequest } from 'next/server'

import { AppError } from '@/lib/errors'
import { contentErrorResponse, contentResponse } from '@/lib/http'
import { listWords } from '@/lib/services/wordService'
import { getSupabase } from '@/lib/supabase/server'
import { formatValidationError } from '@/lib/validation/common'
import { wordListParamsSchema } from '@/lib/validation/words'

export async function GET(request: NextRequest) {
  const parsedParams = wordListParamsSchema.safeParse(
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
    const result = await listWords(db, parsedParams.data, user?.id)

    return contentResponse(result)
  } catch (error) {
    if (error instanceof AppError) {
      return contentErrorResponse(error.code, error.message, error.status)
    }

    console.error('Failed to list words', error)
    return contentErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
  }
}
