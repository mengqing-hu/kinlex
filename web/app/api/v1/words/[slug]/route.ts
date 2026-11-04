import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { AppError } from '@/lib/errors'
import {
  CONTENT_CACHE_CONTROL,
  contentErrorResponse,
  contentResponse,
  privateResponse,
} from '@/lib/http'
import { getWordDetail } from '@/lib/services/wordService'
import { getSupabase } from '@/lib/supabase/server'
import { formatValidationError } from '@/lib/validation/common'
import { wordDetailParamsSchema, wordSlugSchema } from '@/lib/validation/words'

interface WordDetailRouteContext {
  params: Promise<{ slug: string }>
}

export async function GET(request: NextRequest, context: WordDetailRouteContext) {
  const { slug: rawSlug } = await context.params
  const parsedSlug = wordSlugSchema.safeParse(rawSlug)
  const parsedParams = wordDetailParamsSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  )

  if (!parsedSlug.success) {
    return contentErrorResponse('INVALID_PARAMS', formatValidationError(parsedSlug.error), 400)
  }

  if (!parsedParams.success) {
    return contentErrorResponse('INVALID_PARAMS', formatValidationError(parsedParams.error), 400)
  }

  try {
    const db = await getSupabase()
    const {
      data: { user },
    } = await db.auth.getUser()
    const result = await getWordDetail(db, parsedSlug.data, parsedParams.data, user?.id)

    if (result.kind === 'redirect') {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = `/api/v1/words/${encodeURIComponent(result.slug)}`
      return NextResponse.redirect(redirectUrl, {
        status: 301,
        headers: { 'Cache-Control': CONTENT_CACHE_CONTROL },
      })
    }

    // Signed-in results carry the user's favorite flag, so they must not land in a shared cache.
    return user ? privateResponse(result.word) : contentResponse(result.word)
  } catch (error) {
    if (error instanceof AppError) {
      return contentErrorResponse(error.code, error.message, error.status)
    }

    console.error('Failed to load word detail', error)
    return contentErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
  }
}
