import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { AppearanceSettings } from '@/components/me/AppearanceSettings'
import { SettingsForm } from '@/components/me/SettingsForm'
import { getProfile } from '@/lib/services/profileService'

import { requireUser } from '../requireUser'

// Listed on the server, so the page and the browser agree on the options.
const timezones = Intl.supportedValuesOf('timeZone')

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settingsPage')
  return { title: t('metadataTitle') }
}

export default async function SettingsPage() {
  const { supabase, user } = await requireUser('/me/settings')
  const [profile, t] = await Promise.all([
    getProfile(supabase, user.id),
    getTranslations('settingsPage'),
  ])

  return (
    <div className="space-y-5">
      <AppearanceSettings />
      <SettingsForm
        labels={{
          title: t('title'),
          language: t('language'),
          languageHint: t('languageHint'),
          timezone: t('timezone'),
          timezoneHint: t('timezoneHint'),
          publicProfile: t('publicProfile'),
          saveError: t('saveError'),
          deleteTitle: t('deleteTitle'),
          deleteDescription: t('deleteDescription'),
          deleteAction: t('deleteAction'),
          deleteConfirm: t('deleteConfirm'),
        }}
        profile={profile}
        timezones={timezones}
      />
    </div>
  )
}
