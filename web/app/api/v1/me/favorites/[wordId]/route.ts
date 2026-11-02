import { AppError } from '@/lib/errors'
import { privateErrorResponse, privateResponse } from '@/lib/http'
import { requireUser } from '@/lib/services/authService'
import { updateFavorite } from '@/lib/services/favoriteService'
import { getSupabase } from '@/lib/supabase/server'
import { formatValidationError } from '@/lib/validation/common'
import { favoriteWordIdSchema } from '@/lib/validation/me'

interface FavoriteRouteContext {
  params: Promise<{ wordId: string }>
}

async function update(context: FavoriteRouteContext, favorited: boolean) {
  const { wordId } = await context.params
  const parsed = favoriteWordIdSchema.safeParse(wordId)
  if (!parsed.success) {
    return privateErrorResponse('INVALID_PARAMS', formatValidationError(parsed.error), 400)
  }
  try {
    const db = await getSupabase()
    const user = await requireUser(db)
    await updateFavorite(db, user.id, parsed.data, favorited)
    return privateResponse({ favorited })
  } catch (error) {
    if (error instanceof AppError)
      return privateErrorResponse(error.code, error.message, error.status)
    console.error('Failed to update favorite', error)
    return privateErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
  }
}

export const PUT = (_request: Request, context: FavoriteRouteContext) => update(context, true)
export const DELETE = (_request: Request, context: FavoriteRouteContext) => update(context, false)
