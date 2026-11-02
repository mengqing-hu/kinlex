import type { NextRequest } from 'next/server'

import { AppError } from '@/lib/errors'
import { privateErrorResponse, privateResponse } from '@/lib/http'
import { requireUser } from '@/lib/services/authService'
import { getProfile, saveProfile } from '@/lib/services/profileService'
import { getSupabase } from '@/lib/supabase/server'
import { formatValidationError } from '@/lib/validation/common'
import { profileUpdateSchema } from '@/lib/validation/me'

async function handleError(error: unknown) {
  if (error instanceof AppError)
    return privateErrorResponse(error.code, error.message, error.status)
  console.error('Profile request failed', error)
  return privateErrorResponse('INTERNAL', 'An unexpected error occurred', 500)
}

export async function GET() {
  try {
    const db = await getSupabase()
    const user = await requireUser(db)
    return privateResponse(await getProfile(db, user.id))
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(request: NextRequest) {
  const parsed = profileUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return privateErrorResponse('INVALID_PARAMS', formatValidationError(parsed.error), 400)
  }
  try {
    const db = await getSupabase()
    const user = await requireUser(db)
    return privateResponse(await saveProfile(db, user.id, parsed.data))
  } catch (error) {
    return handleError(error)
  }
}
