import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

import { isLocale } from '@/i18n/locales'
import { privateErrorResponse } from '@/lib/http'
import { isSupportedLanguage } from '@/lib/languages'

export type RateLimitBucket = 'pages' | 'api' | 'wordIds'

// Requests one visitor, an account when signed in and an IP address otherwise, may make. A reader
// stays well below these, while paging through the whole dictionary takes hours per visitor.
const bucketLimits: Record<RateLimitBucket, { perMinute: number; perHour: number }> = {
  pages: { perMinute: 60, perHour: 1000 },
  api: { perMinute: 120, perHour: 2000 },
  // Every id of a list in one response; the site only needs it to reset a list.
  wordIds: { perMinute: 10, perHour: 100 },
}

// If the counter store is slow, let the request through rather than hold up the page.
const LIMIT_TIMEOUT_MS = 1000

type Limiters = Record<RateLimitBucket, Ratelimit[]>

let limiters: Limiters | null | undefined

function createLimiters(): Limiters | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        'UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing; rate limiting is off',
      )
    }
    return null
  }

  const redis = new Redis({ url, token })
  const createBucket = (bucket: RateLimitBucket): Ratelimit[] => [
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(bucketLimits[bucket].perMinute, '1 m'),
      prefix: `kinlex:ratelimit:${bucket}:minute`,
      timeout: LIMIT_TIMEOUT_MS,
    }),
    new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(bucketLimits[bucket].perHour, '1 h'),
      prefix: `kinlex:ratelimit:${bucket}:hour`,
      timeout: LIMIT_TIMEOUT_MS,
    }),
  ]

  return {
    pages: createBucket('pages'),
    api: createBucket('api'),
    wordIds: createBucket('wordIds'),
  }
}

function getLimiters(): Limiters | null {
  if (limiters === undefined) limiters = createLimiters()
  return limiters
}

// The dictionary content a visitor can page through: the content API and the language pages.
export function getRateLimitBucket(pathname: string): RateLimitBucket | null {
  if (pathname === '/api/v1/words/ids') return 'wordIds'
  // A signed-in learner's own data and feedback are not content.
  if (pathname === '/api/v1/me' || pathname.startsWith('/api/v1/me/')) return null
  if (pathname === '/api/v1/feedback') return null
  if (pathname.startsWith('/api/v1/')) return 'api'
  if (pathname.startsWith('/api/')) return null

  const [, locale = '', language = ''] = pathname.split('/')
  return isLocale(locale) && isSupportedLanguage(language) ? 'pages' : null
}

// The hosting platform's proxy puts the client first in x-forwarded-for.
export function getClientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
  )
}

// Seconds until the visitor may try again, or null when the request may go ahead.
export async function checkRateLimit(
  bucket: RateLimitBucket,
  visitor: string,
): Promise<number | null> {
  const bucketLimiters = getLimiters()?.[bucket]
  if (!bucketLimiters) return null

  try {
    const results = await Promise.all(bucketLimiters.map((limiter) => limiter.limit(visitor)))
    const blocked = results.filter(({ success }) => !success)
    if (blocked.length === 0) return null

    const reset = Math.max(...blocked.map(({ reset }) => reset))
    return Math.max(1, Math.ceil((reset - Date.now()) / 1000))
  } catch (error) {
    // An outage of the counter store must not take the site down with it.
    console.error('Rate limit check failed', error)
    return null
  }
}

export function rateLimitedResponse(bucket: RateLimitBucket, retryAfterSeconds: number) {
  const response =
    bucket === 'pages'
      ? new NextResponse('Too many requests. Please wait a moment and try again.', {
          status: 429,
          headers: {
            'Cache-Control': 'private, no-store',
            'Content-Type': 'text/plain; charset=utf-8',
          },
        })
      : privateErrorResponse('RATE_LIMITED', 'Too many requests, please slow down', 429)

  response.headers.set('Retry-After', String(retryAfterSeconds))
  return response
}
