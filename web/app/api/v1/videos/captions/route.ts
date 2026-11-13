import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { isSupportedLanguage } from '@/lib/languages'
import { listVideoCaptions } from '@/lib/videos/jobs'
import { getYouTubeId } from '@/lib/videos/types'

// Which YouTube captions a video has in a language, so the add form offers only those. It asks
// the local pipeline, so like processing it is not offered on a deployed site.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }
  const url = request.nextUrl.searchParams.get('url') ?? ''
  const language = request.nextUrl.searchParams.get('lang') ?? ''
  const id = getYouTubeId(url)
  if (!id || !isSupportedLanguage(language)) {
    return new NextResponse(null, { status: 400 })
  }
  try {
    return NextResponse.json(await listVideoCaptions(id, language))
  } catch {
    return new NextResponse(null, { status: 502 })
  }
}
