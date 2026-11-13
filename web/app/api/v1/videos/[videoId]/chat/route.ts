import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { isSupportedLanguage } from '@/lib/languages'
import {
  chatRequestSchema,
  isChatConfigured,
  ModelBusyError,
  streamChatReply,
} from '@/lib/videos/chat'
import { getStudyVideo } from '@/lib/videos/studyFiles'

interface ChatRouteContext {
  params: Promise<{ videoId: string }>
}

// A reply to the learner's question about the video, streamed as plain text. The video's
// language comes as ?lang=, as for its media.
export async function POST(request: NextRequest, context: ChatRouteContext) {
  const { videoId } = await context.params
  const language = request.nextUrl.searchParams.get('lang') ?? ''
  const parsed = chatRequestSchema.safeParse(await request.json().catch(() => null))
  if (!isSupportedLanguage(language) || !parsed.success) {
    return new NextResponse(null, { status: 400 })
  }
  if (!isChatConfigured()) {
    return new NextResponse(null, { status: 503 })
  }
  const video = await getStudyVideo(language, videoId, parsed.data.meaningLanguage)
  if (!video || video.lines.length === 0) {
    return new NextResponse(null, { status: 404 })
  }

  try {
    const reply = await streamChatReply(video, parsed.data, request.signal)
    return new NextResponse(reply, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    if (error instanceof ModelBusyError) {
      return new NextResponse(null, { status: 429 })
    }
    console.error('Video chat failed', error)
    return new NextResponse(null, { status: 502 })
  }
}
