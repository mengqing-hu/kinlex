import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any -- the generated types predate the video tables. */

import { getSupabase } from '@/lib/supabase/server'
import { missingTable } from '@/lib/videos/studyFiles'
import type { VideoProgress } from '@/lib/videos/types'

// The learner's own client, so row level security keeps each learner to their own progress.
async function progressDb(): Promise<any> {
  return getSupabase()
}

interface ProgressRow {
  video_id: string
  position_ms: number
  finished: boolean
}

function toProgress(row: ProgressRow): VideoProgress {
  return { positionMs: row.position_ms, finished: row.finished }
}

// How far the learner has watched the video, or null when they have not, or when the installation
// has no video tables.
export async function getVideoProgress(id: string): Promise<VideoProgress | null> {
  const db = await progressDb()
  const { data, error } = await db
    .from('video_progress')
    .select('video_id, position_ms, finished')
    .eq('video_id', id)
    .maybeSingle()
  if (missingTable(error)) return null
  if (error) throw new Error(`read progress of video ${id}: ${error.message}`)
  return data ? toProgress(data as ProgressRow) : null
}

// How far the learner has watched each of their videos, by video id.
export async function listVideoProgress(): Promise<Map<string, VideoProgress>> {
  const db = await progressDb()
  const { data, error } = await db.from('video_progress').select('video_id, position_ms, finished')
  if (missingTable(error)) return new Map()
  if (error) throw new Error(`list video progress: ${error.message}`)
  return new Map(
    ((data ?? []) as ProgressRow[]).map((row) => [row.video_id, toProgress(row)] as const),
  )
}

// Records where the learner is in the video. finished is only ever written as true, and an upsert
// leaves the columns it is not given as they were, so a finished video stays finished.
export async function saveVideoProgress(
  userId: string,
  id: string,
  positionMs: number,
  finished: boolean,
): Promise<void> {
  const db = await progressDb()
  const { error } = await db.from('video_progress').upsert(
    {
      owner_id: userId,
      video_id: id,
      position_ms: Math.round(positionMs),
      updated_at: new Date().toISOString(),
      ...(finished ? { finished: true } : {}),
    },
    { onConflict: 'owner_id,video_id' },
  )
  if (missingTable(error)) return
  if (error) throw new Error(`save progress of video ${id}: ${error.message}`)
}
