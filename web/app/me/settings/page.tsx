import type { Metadata } from 'next'

import { SettingsForm } from '@/components/me/SettingsForm'
import { getProfile } from '@/lib/services/profileService'

import { requireUser } from '../requireUser'

export const metadata: Metadata = {
  title: 'Settings',
}

export default async function SettingsPage() {
  const { supabase, user } = await requireUser('/me/settings')
  const profile = await getProfile(supabase, user.id)

  return <SettingsForm profile={profile} />
}
