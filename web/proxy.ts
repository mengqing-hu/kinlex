import { type NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'

import { defaultLocale, isLocale } from '@/i18n/locales'
import { routing } from '@/i18n/routing'
import { isSupportedLanguage } from '@/lib/languages'
import {
  checkRateLimit,
  getClientIp,
  getRateLimitBucket,
  rateLimitedResponse,
} from '@/lib/rateLimit'
import { updateSession } from '@/lib/supabase/middleware'

const handleLocale = createMiddleware(routing)

// Where next-intl remembers the language a visitor last chose.
const LOCALE_COOKIE = 'NEXT_LOCALE'

// The sections of a learning language. The older /levels and /roots are moved by next.config.ts.
const learningSections = new Set(['vocabulary', 'word-parts', 'word', 'flashcards', 'favorites'])

// Learning pages used to start with the learning language, e.g. /de/vocabulary/a1. Old links and
// search results move to the same page in the learner's language, or English for a first visit.
function redirectPathWithoutLocale(request: NextRequest): NextResponse | null {
  const [, language = '', section = ''] = request.nextUrl.pathname.split('/')
  if (!isSupportedLanguage(language) || !learningSections.has(section)) return null

  const savedLocale = request.cookies.get(LOCALE_COOKIE)?.value
  const locale = savedLocale && isLocale(savedLocale) ? savedLocale : defaultLocale
  const url = request.nextUrl.clone()
  url.pathname = `/${locale}${request.nextUrl.pathname}`
  return NextResponse.redirect(url, 308)
}

// Pages get a language in their address; the API, the sign-in callback and the files search
// engines read do not.
function isPagePath(pathname: string) {
  return (
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/auth/') &&
    pathname !== '/sitemap.xml' &&
    pathname !== '/robots.txt'
  )
}

export async function proxy(request: NextRequest) {
  const moved = redirectPathWithoutLocale(request)
  if (moved) return moved

  const { response, user } = await updateSession(request)
  if (response.headers.has('location')) return response

  const bucket = getRateLimitBucket(request.nextUrl.pathname)
  if (bucket) {
    // Signed-in learners get a count of their own, so a class behind one address is not limited
    // as a single visitor.
    const visitor = user ? `user:${user.id}` : `ip:${getClientIp(request.headers)}`
    const retryAfterSeconds = await checkRateLimit(bucket, visitor)
    if (retryAfterSeconds !== null) return rateLimitedResponse(bucket, retryAfterSeconds)
  }

  if (!isPagePath(request.nextUrl.pathname)) return response

  // The session refresh above has already updated the request's cookies, which the locale
  // handling passes on; the browser still needs the new ones set on the final response.
  const localeResponse = handleLocale(request)
  response.cookies.getAll().forEach((cookie) => localeResponse.cookies.set(cookie))
  return localeResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
