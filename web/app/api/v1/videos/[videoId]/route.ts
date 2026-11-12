import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { isSupportedLanguage } from '@/lib/languages'
import { deleteStudyVideo, renameStudyVideo } from '@/lib/videos/studyFiles'

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
  const renamed = await renameStudyVideo(language, videoId, parsed.data.title)
  return new NextResponse(null, { status: renamed ? 204 : 404 })
}

export async function DELETE(request: NextRequest, context: VideoRouteContext) {
  const { videoId } = await context.params
  const language = videoLanguage(request)
  if (!language) {
    return new NextResponse(null, { status: 400 })
  }
  const deleted = await deleteStudyVideo(language, videoId)
  return new NextResponse(null, { status: deleted ? 204 : 404 })
}
