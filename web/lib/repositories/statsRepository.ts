import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { RepositoryError } from '@/lib/errors'
import { getActivityWindowStart, toDateKey } from '@/lib/utils/activityCalendar'
import type { Database } from '@/types/db'
import type { UserStatistics } from '@/types/domain'

function assertQuerySucceeded(error: PostgrestError | null, operation: string): void {
  if (error) throw new RepositoryError(`Failed to ${operation}`, { cause: error })
}

export async function findUserStatistics(
  db: SupabaseClient<Database>,
  userId: string,
): Promise<UserStatistics> {
  const [dailyResult, statsResult, languageStatsResult] = await Promise.all([
    db
      .from('daily_study_time')
      .select('date, active_seconds, words_viewed')
      .eq('user_id', userId)
      .gte('date', toDateKey(getActivityWindowStart(new Date())))
      .order('date', { ascending: true }),
    db
      .from('user_stats')
      .select('total_days, current_streak, longest_streak')
      .eq('user_id', userId)
      .maybeSingle(),
    db.from('user_language_stats').select('words_mastered').eq('user_id', userId),
  ])
  assertQuerySucceeded(dailyResult.error, 'load daily activity')
  assertQuerySucceeded(statsResult.error, 'load user statistics')
  assertQuerySucceeded(languageStatsResult.error, 'load language statistics')

  const dailyActivity = (dailyResult.data ?? []).map((day) => ({
    date: day.date,
    activeSeconds: day.active_seconds,
    wordsViewed: day.words_viewed,
  }))
  return {
    totalDays: statsResult.data?.total_days ?? 0,
    currentStreak: statsResult.data?.current_streak ?? 0,
    longestStreak: statsResult.data?.longest_streak ?? 0,
    activeSeconds: dailyActivity.reduce((total, day) => total + day.activeSeconds, 0),
    wordsViewed: dailyActivity.reduce((total, day) => total + day.wordsViewed, 0),
    wordsMastered: (languageStatsResult.data ?? []).reduce(
      (total, language) => total + language.words_mastered,
      0,
    ),
    dailyActivity,
  }
}
