import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { RepositoryError } from '@/lib/errors'
import type { ActivityEventInput } from '@/lib/validation/me'
import type { Database } from '@/types/db'

function assertQuerySucceeded(error: PostgrestError | null, operation: string): void {
  if (error) throw new RepositoryError(`Failed to ${operation}`, { cause: error })
}

export async function insertNewActivityEvents(
  db: SupabaseClient<Database>,
  userId: string,
  events: ActivityEventInput[],
): Promise<ActivityEventInput[]> {
  const clientIds = events.map((event) => event.clientEventId)
  const { data: existing, error: existingError } = await db
    .from('activity_events')
    .select('client_event_id')
    .eq('user_id', userId)
    .in('client_event_id', clientIds)
  assertQuerySucceeded(existingError, 'check activity events')

  const existingIds = new Set((existing ?? []).map((event) => event.client_event_id))
  const newEvents = events.filter((event) => !existingIds.has(event.clientEventId))
  if (newEvents.length === 0) return []

  const { error } = await db.from('activity_events').insert(
    newEvents.map((event) => ({
      user_id: userId,
      client_event_id: event.clientEventId,
      language: event.language,
      event_type: event.eventType,
      target_type: event.targetType,
      target_id: event.targetId,
      value: event.value,
      occurred_at: event.occurredAt,
    })),
  )
  assertQuerySucceeded(error, 'record activity events')
  return newEvents
}

export async function addDailyActivity(
  db: SupabaseClient<Database>,
  userId: string,
  date: string,
  language: string,
  activeSeconds: number,
  wordsViewed: number,
): Promise<void> {
  const { error } = await db.rpc('update_daily_study_time', {
    p_user_id: userId,
    p_date: date,
    p_language: language,
    p_active_seconds: activeSeconds,
    p_words_viewed: wordsViewed,
  })
  assertQuerySucceeded(error, 'update daily activity')
}

export async function refreshUserStatistics(
  db: SupabaseClient<Database>,
  userId: string,
  today: string,
): Promise<void> {
  const { error } = await db.rpc('refresh_user_stats', { p_user_id: userId, p_today: today })
  assertQuerySucceeded(error, 'refresh user statistics')
}
