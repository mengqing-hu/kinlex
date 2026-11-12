import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { isLocale } from '@/i18n/locales'
import { isSupportedLanguage } from '@/lib/languages'
import { startVideoJob } from '@/lib/videos/jobs'
import { getYouTubeId } from '@/lib/videos/types'

const startSchema = z.object({
  url: z.string(),
  language: z.string().refine(isSupportedLanguage),
  meaningLanguage: z.string().refine(isLocale),
})

// Starts processing a YouTube video on this computer; the job route follows it. Processing runs
// the pipeline locally, so a deployed site does not offer it.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }
  const parsed = startSchema.safeParse(await request.json().catch(() => null))
  const id = parsed.success ? getYouTubeId(parsed.data.url) : null
  if (!parsed.success || !id) {
    return new NextResponse(null, { status: 400 })
  }
  await startVideoJob({
    id,
    language: parsed.data.language,
    meaningLanguage: parsed.data.meaningLanguage,
  })
  return NextResponse.json({ id }, { status: 202 })
}
