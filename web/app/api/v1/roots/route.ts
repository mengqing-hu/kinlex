import type { NextRequest } from 'next/server'

import { AppError } from '@/lib/errors'
import { contentErrorResponse, contentResponse } from '@/lib/http'
import { listMorphemes } from '@/lib/services/morphemeService'
import { getPublicSupabase } from '@/lib/supabase/server'
import { formatValidationError } from '@/lib/validation/common'
import { rootListParamsSchema } from '@/lib/validation/roots'

export async function GET(request: NextRequest) {
  const parsedParams = rootListParamsSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  )

  if (!parsedParams.success) {
    return contentErrorResponse('INVALID_PARAMS', formatValidationError(parsedParams.error), 400)
  }

  try {
    const db = getPublicSupabase()
    return contentResponse(
      await listMorphemes(db, parsedParams.data.lang, parsedParams.data.explain),
    )
  } catch (error) {
    if (error instanceof AppError) {
      return contentErrorResponse(error.code, error.message, error.status)
    }

    console.error('Failed to list morphemes', error)
    return contentErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
  }
}
