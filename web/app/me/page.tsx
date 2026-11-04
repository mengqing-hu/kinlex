import type { Metadata } from 'next'

import { Heatmap } from '@/components/me/Heatmap'
import { StatsPanel } from '@/components/me/StatsPanel'
import { getUserStatistics } from '@/lib/services/statsService'
import { toDateKey } from '@/lib/utils/activityCalendar'

import { requireUser } from './requireUser'

export const metadata: Metadata = {
  title: 'Profile',
}

export default async function ProfilePage() {
  const { supabase, user } = await requireUser('/me')
  const stats = await getUserStatistics(supabase, user.id)

  return (
    <div className="space-y-5">
      <StatsPanel stats={stats} />
      <Heatmap days={stats.dailyActivity} today={toDateKey(new Date())} />
    </div>
  )
}
