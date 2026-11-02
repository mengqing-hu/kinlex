import type { SupabaseClient } from '@supabase/supabase-js'

import { getDateInTimezone, systemClock, type Clock } from '@/lib/clock'
import {
  addDailyActivity,
  insertNewActivityEvents,
  refreshUserStatistics,
} from '@/lib/repositories/eventRepository'
import { findProfile } from '@/lib/repositories/profileRepository'
import type { ActivityEventInput } from '@/lib/validation/me'
import type { Database } from '@/types/db'

interface DailyIncrement {
  date: string
  language: string
  activeSeconds: number
  wordsViewed: number
}

export async function recordActivityEvents(
  db: SupabaseClient<Database>,
  userId: string,
  events: ActivityEventInput[],
  clock: Clock = systemClock,
): Promise<{ accepted: number }> {
  const [newEvents, profile] = await Promise.all([
    insertNewActivityEvents(db, userId, events),
    findProfile(db, userId),
  ])
  const increments = new Map<string, DailyIncrement>()

  for (const event of newEvents) {
    const occurredAt = new Date(event.occurredAt)
    const date = getDateInTimezone(occurredAt, profile.timezone)
    const key = `${date}:${event.language}`
    const increment = increments.get(key) ?? {
      date,
      language: event.language,
      activeSeconds: 0,
      wordsViewed: 0,
    }
    if (event.eventType === 'study_heartbeat') increment.activeSeconds += event.value ?? 0
    if (event.eventType === 'view_word') increment.wordsViewed += 1
    increments.set(key, increment)
  }

  await Promise.all(
    [...increments.values()].map((increment) =>
      addDailyActivity(
        db,
        userId,
        increment.date,
        increment.language,
        increment.activeSeconds,
        increment.wordsViewed,
      ),
    ),
  )

  await refreshUserStatistics(db, userId, getDateInTimezone(clock.now(), profile.timezone))
  return { accepted: newEvents.length }
}
