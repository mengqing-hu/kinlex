import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { RepositoryError } from '@/lib/errors'
import type { ActivityEventInput } from '@/lib/validation/me'
import type { Database } from '@/types/db'

function assertQuerySucceeded(error: PostgrestError | null, operation: string): void {
  if (error) throw new RepositoryError(`Failed to ${operation}`, { cause: error })
}

// Sends of the same queued events can overlap, so duplicates are skipped in the insert itself
// rather than looked up first, and the rows that went in tell which events were new.
export async function insertNewActivityEvents(
  db: SupabaseClient<Database>,
  userId: string,
  events: ActivityEventInput[],
): Promise<ActivityEventInput[]> {
  const { data, error } = await db
    .from('activity_events')
    .upsert(
      events.map((event) => ({
        user_id: userId,
        client_event_id: event.clientEventId,
        language: event.language,
        event_type: event.eventType,
        target_type: event.targetType,
        target_id: event.targetId,
        value: event.value,
        occurred_at: event.occurredAt,
      })),
      { onConflict: 'user_id,client_event_id', ignoreDuplicates: true },
    )
    .select('client_event_id')
  assertQuerySucceeded(error, 'record activity events')

  const insertedIds = new Set((data ?? []).map((event) => event.client_event_id))
  return events.filter((event) => insertedIds.has(event.clientEventId))
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
