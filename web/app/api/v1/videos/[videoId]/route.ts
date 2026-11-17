import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { isSupportedLanguage } from '@/lib/languages'
import { deleteStudyVideo, renameStudyVideo } from '@/lib/videos/studyFiles'
import { videoRouteUser } from '@/lib/videos/access'
import { reprocessVideoJob } from '@/lib/videos/jobs'

interface VideoRouteContext {
  params: Promise<{ videoId: string }>
}

const renameSchema = z.object({ title: z.string().trim().min(1).max(200) })

// The video's language comes as ?lang=, as for its media.
function videoLanguage(request: NextRequest): string | null {
  const language = request.nextUrl.searchParams.get('lang') ?? ''
  return isSupportedLanguage(language) ? language : null
}

export async function PATCH(request: NextRequest, context: VideoRouteContext) {
  const { videoId } = await context.params
  const language = videoLanguage(request)
  const parsed = renameSchema.safeParse(await request.json().catch(() => null))
  if (!language || !parsed.success) {
    return new NextResponse(null, { status: 400 })
  }
  const { response } = await videoRouteUser()
  if (response) return response
  const renamed = await renameStudyVideo(language, videoId, parsed.data.title)
  return new NextResponse(null, { status: renamed ? 204 : 404 })
}

export async function DELETE(request: NextRequest, context: VideoRouteContext) {
  const { videoId } = await context.params
  const language = videoLanguage(request)
  if (!language) {
    return new NextResponse(null, { status: 400 })
  }
  const { response } = await videoRouteUser()
  if (response) return response
  const deleted = await deleteStudyVideo(language, videoId)
  return new NextResponse(null, { status: deleted ? 204 : 404 })
}

export async function POST(request: NextRequest, context: VideoRouteContext) {
  const { videoId } = await context.params
  const language = videoLanguage(request)
  const meaningLanguage = request.nextUrl.searchParams.get('explain') ?? 'en'
  if (!language || !/^[\w-]{11}$/.test(videoId)) return new NextResponse(null, { status: 400 })
  const { user, response } = await videoRouteUser()
  if (response) return response
  await reprocessVideoJob({
    id: videoId,
    language,
    meaningLanguage,
    captions: 'whisper',
    ownerId: user.id,
  })
  return new NextResponse(null, { status: 202 })
}
