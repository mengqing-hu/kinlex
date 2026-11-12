import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { isSupportedLanguage } from '@/lib/languages'
import { getVideoFile } from '@/lib/videos/studyFiles'

interface VideoMediaRouteContext {
  params: Promise<{ videoId: string }>
}

const RANGE = /^bytes=(\d*)-(\d*)$/

// The downloaded video of ?lang=, in the byte ranges the browser asks for, so it can seek.
export async function GET(request: NextRequest, context: VideoMediaRouteContext) {
  const { videoId } = await context.params
  const language = request.nextUrl.searchParams.get('lang') ?? ''
  const file = isSupportedLanguage(language) ? await getVideoFile(language, videoId) : null
  if (!file) {
    return new NextResponse(null, { status: 404 })
  }

  const headers = {
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
    'Content-Type': 'video/mp4',
  }
  const range = RANGE.exec(request.headers.get('range') ?? '')
  if (!range) {
    const body = Readable.toWeb(createReadStream(file.path)) as ReadableStream
    return new NextResponse(body, {
      headers: { ...headers, 'Content-Length': String(file.size) },
    })
  }

  // "bytes=-500" is the last 500 bytes; "bytes=100-" runs to the end.
  const [, first = '', last = ''] = range
  const start = first ? Number(first) : Math.max(0, file.size - Number(last))
  const end = first && last ? Math.min(Number(last), file.size - 1) : file.size - 1
  if (start > end || start >= file.size) {
    return new NextResponse(null, {
      status: 416,
      headers: { ...headers, 'Content-Range': `bytes */${file.size}` },
    })
  }
  const body = Readable.toWeb(createReadStream(file.path, { start, end })) as ReadableStream
  return new NextResponse(body, {
    status: 206,
    headers: {
      ...headers,
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${file.size}`,
    },
  })
}
