import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getSupabase } from '@/lib/supabase/server'
import { FavoritesList } from '@/components/me/FavoritesList'
import { AccountSync } from '@/components/me/AccountSync'
import { Heatmap } from '@/components/me/Heatmap'
import { SettingsForm } from '@/components/me/SettingsForm'
import { StatsPanel } from '@/components/me/StatsPanel'
import { listFavorites } from '@/lib/services/favoriteService'
import { getProfile } from '@/lib/services/profileService'
import { getUserStatistics } from '@/lib/services/statsService'

import { signOut } from './actions'

export const metadata: Metadata = {
  title: 'Your account',
}

export default async function ProfilePage() {
  const supabase = await getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/me')
  }

  const [profile, favorites, stats] = await Promise.all([
    getProfile(supabase, user.id),
    listFavorites(supabase, user.id),
    getUserStatistics(supabase, user.id),
  ])

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-12">
      <AccountSync />
      <p className="text-sm font-medium tracking-widest text-neutral-500 uppercase">Account</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">You are signed in</h1>
      <p className="mt-4 text-[var(--mute)]">{user.email}</p>

      <form action={signOut} className="mt-6">
        <button
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          type="submit"
        >
          Sign out
        </button>
      </form>
      <div className="mt-12 space-y-14">
        <StatsPanel stats={stats} />
        <Heatmap days={stats.dailyActivity} />
        <FavoritesList words={favorites} />
        <SettingsForm profile={profile} />
      </div>
    </main>
  )
}
