import type { NextRequest } from 'next/server'

import { AppError } from '@/lib/errors'
import { contentErrorResponse, contentResponse } from '@/lib/http'
import { searchWords } from '@/lib/services/searchService'
import { getPublicSupabase } from '@/lib/supabase/server'
import { formatValidationError } from '@/lib/validation/common'
import { searchParamsSchema } from '@/lib/validation/search'

export async function GET(request: NextRequest) {
  const parsedParams = searchParamsSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  )
  if (!parsedParams.success) {
    return contentErrorResponse('INVALID_PARAMS', formatValidationError(parsedParams.error), 400)
  }

  try {
    const { lang, q, limit } = parsedParams.data
    return contentResponse(await searchWords(getPublicSupabase(), lang, q, limit))
  } catch (error) {
    if (error instanceof AppError) {
      return contentErrorResponse(error.code, error.message, error.status)
    }
    console.error('Failed to search words', error)
    return contentErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
  }
}
