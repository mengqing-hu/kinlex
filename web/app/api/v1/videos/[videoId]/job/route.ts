import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { isLocale } from '@/i18n/locales'
import { isSupportedLanguage } from '@/lib/languages'
import { readVideoJob } from '@/lib/videos/jobs'

interface VideoJobRouteContext {
  params: Promise<{ videoId: string }>
}

// How processing the video of ?lang= for ?explain= is going.
export async function GET(request: NextRequest, context: VideoJobRouteContext) {
  const { videoId } = await context.params
  const language = request.nextUrl.searchParams.get('lang') ?? ''
  const meaningLanguage = request.nextUrl.searchParams.get('explain') ?? ''
  if (
    !isSupportedLanguage(language) ||
    !isLocale(meaningLanguage) ||
    !/^[\w-]{11}$/.test(videoId)
  ) {
    return new NextResponse(null, { status: 400 })
  }
  const job = await readVideoJob({ id: videoId, language, meaningLanguage })
  return job
    ? NextResponse.json(job, { headers: { 'Cache-Control': 'no-store' } })
    : new NextResponse(null, { status: 404 })
}
