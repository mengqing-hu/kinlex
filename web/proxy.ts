import type { NextRequest } from 'next/server'

import {
  checkRateLimit,
  getClientIp,
  getRateLimitBucket,
  rateLimitedResponse,
} from '@/lib/rateLimit'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)

  const bucket = getRateLimitBucket(request.nextUrl.pathname)
  if (!bucket) return response

  // Signed-in learners get a count of their own, so a class behind one address is not limited
  // as a single visitor.
  const visitor = user ? `user:${user.id}` : `ip:${getClientIp(request.headers)}`
  const retryAfterSeconds = await checkRateLimit(bucket, visitor)
  return retryAfterSeconds === null ? response : rateLimitedResponse(bucket, retryAfterSeconds)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
