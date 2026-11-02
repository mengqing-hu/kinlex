import { createHash, timingSafeEqual } from 'node:crypto'

import { revalidatePath } from 'next/cache'

import { privateErrorResponse, privateResponse } from '@/lib/http'

export const dynamic = 'force-dynamic'

// Compare digests so the check takes the same time whatever the token length.
function matchesSecret(token: string, secret: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(token), digest(secret))
}

// Called after the pipeline enriches words or adds audio. Content pages use ISR, so
// the whole route tree is revalidated; the next request regenerates each page from the database.
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) {
    console.error('REVALIDATE_SECRET is not configured')
    return privateErrorResponse('INTERNAL', 'Revalidation is not configured', 500)
  }

  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token || !matchesSecret(token, secret)) {
    return privateErrorResponse('UNAUTHORIZED', 'Invalid revalidation token', 401)
  }

  revalidatePath('/', 'layout')
  return privateResponse({ revalidated: true })
}
