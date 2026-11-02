import type { NextRequest } from 'next/server'

import { AppError } from '@/lib/errors'
import { contentErrorResponse, contentResponse } from '@/lib/http'
import { listTopics } from '@/lib/services/topicService'
import { getPublicSupabase } from '@/lib/supabase/server'
import { formatValidationError } from '@/lib/validation/common'
import { topicListParamsSchema } from '@/lib/validation/topics'

export async function GET(request: NextRequest) {
  const parsedParams = topicListParamsSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  )

  if (!parsedParams.success) {
    return contentErrorResponse('INVALID_PARAMS', formatValidationError(parsedParams.error), 400)
  }

  try {
    const db = getPublicSupabase()
    const topics = await listTopics(db, parsedParams.data.lang)
    return contentResponse(topics)
  } catch (error) {
    if (error instanceof AppError) {
      return contentErrorResponse(error.code, error.message, error.status)
    }

    console.error('Failed to list topics', error)
    return contentErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
  }
}
