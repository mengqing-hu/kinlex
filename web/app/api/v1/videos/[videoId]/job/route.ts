import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { isLocale } from '@/i18n/locales'
import { isSupportedLanguage } from '@/lib/languages'
import { cancelVideoJob, pauseVideoJob, readVideoJob } from '@/lib/videos/jobs'

interface VideoJobRouteContext {
  params: Promise<{ videoId: string }>
}

// The job the request names: the video, ?lang= it is in and ?explain= it is explained in.
async function jobRequest(request: NextRequest, context: VideoJobRouteContext) {
  const { videoId } = await context.params
  const language = request.nextUrl.searchParams.get('lang') ?? ''
  const meaningLanguage = request.nextUrl.searchParams.get('explain') ?? ''
  if (
    !isSupportedLanguage(language) ||
    !isLocale(meaningLanguage) ||
    !/^[\w-]{11}$/.test(videoId)
  ) {
    return null
  }
  return { id: videoId, language, meaningLanguage }
}

// How processing the video of ?lang= for ?explain= is going.
export async function GET(request: NextRequest, context: VideoJobRouteContext) {
  const named = await jobRequest(request, context)
  if (!named) return new NextResponse(null, { status: 400 })
  const job = await readVideoJob(named)
  return job
    ? NextResponse.json(job, { headers: { 'Cache-Control': 'no-store' } })
    : new NextResponse(null, { status: 404 })
}

// Pausing and cancelling stop a command on this computer and change its files, so like starting
// processing, a deployed site does not offer them.
function unavailableWhenDeployed(): NextResponse | null {
  return process.env.NODE_ENV === 'production' ? new NextResponse(null, { status: 404 }) : null
}

// Pauses processing that is running. Starting it again (POST /api/v1/videos) carries on.
export async function PATCH(request: NextRequest, context: VideoJobRouteContext) {
  const unavailable = unavailableWhenDeployed()
  if (unavailable) return unavailable
  const named = await jobRequest(request, context)
  if (!named) return new NextResponse(null, { status: 400 })
  return (await pauseVideoJob(named))
    ? new NextResponse(null, { status: 204 })
    : new NextResponse(null, { status: 409 })
}

// Cancels processing, stopping it if it runs, so the add page stops listing it.
export async function DELETE(request: NextRequest, context: VideoJobRouteContext) {
  const unavailable = unavailableWhenDeployed()
  if (unavailable) return unavailable
  const named = await jobRequest(request, context)
  if (!named) return new NextResponse(null, { status: 400 })
  return (await cancelVideoJob(named))
    ? new NextResponse(null, { status: 204 })
    : new NextResponse(null, { status: 404 })
}
