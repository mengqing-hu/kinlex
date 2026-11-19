import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { videoRouteUser } from '@/lib/videos/access'
import { saveVideoProgress } from '@/lib/videos/progress'

interface VideoProgressRouteContext {
  params: Promise<{ videoId: string }>
}

const progressSchema = z.object({
  positionMs: z.number().finite().min(0),
  finished: z.boolean(),
})

// Saves where the learner is in the video, as the player reports it while they watch.
export async function PUT(request: NextRequest, context: VideoProgressRouteContext) {
  const { videoId } = await context.params
  const parsed = progressSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !/^[\w-]{11}$/.test(videoId)) {
    return new NextResponse(null, { status: 400 })
  }
  const { user, response } = await videoRouteUser()
  if (response) return response
  await saveVideoProgress(user.id, videoId, parsed.data.positionMs, parsed.data.finished)
  return new NextResponse(null, { status: 204 })
}
