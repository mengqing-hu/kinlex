import type { Metadata } from 'next'

import { Heatmap } from '@/components/me/Heatmap'
import { ProfileCard } from '@/components/me/ProfileCard'
import { StatsPanel } from '@/components/me/StatsPanel'
import { getProfile } from '@/lib/services/profileService'
import { getUserStatistics } from '@/lib/services/statsService'
import { toDateKey } from '@/lib/utils/activityCalendar'

import { requireUser } from './requireUser'

export const metadata: Metadata = {
  title: 'Profile',
}

const memberSinceFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const providerNames: Record<string, string> = { email: 'Email link', google: 'Google' }

export default async function ProfilePage() {
  const { supabase, user } = await requireUser('/me')
  const [profile, stats] = await Promise.all([
    getProfile(supabase, user.id),
    getUserStatistics(supabase, user.id),
  ])
  const googleName: unknown = user.user_metadata.full_name ?? user.user_metadata.name
  const provider = typeof user.app_metadata.provider === 'string' ? user.app_metadata.provider : ''

  return (
    <div className="space-y-5">
      <ProfileCard
        details={[
          ['Signed in with', providerNames[provider] ?? provider],
          ['Member since', memberSinceFormat.format(new Date(user.created_at))],
        ]}
        email={user.email ?? null}
        fallbackName={typeof googleName === 'string' && googleName ? googleName : null}
        profile={profile}
        userId={user.id}
      />
      <StatsPanel stats={stats} />
      <Heatmap days={stats.dailyActivity} today={toDateKey(new Date())} />
    </div>
  )
}
