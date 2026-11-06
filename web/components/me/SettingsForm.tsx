'use client'

import { useLocale } from 'next-intl'
import { useState } from 'react'

import { SettingRow } from '@/components/me/SettingRow'
import { Card } from '@/components/ui/Card'
import { Switch } from '@/components/ui/Switch'
import { isLocale, localeNames, locales, type Locale } from '@/i18n/locales'
import { usePathname, useRouter } from '@/i18n/navigation'
import { fetchApiData } from '@/lib/client/apiClient'
import type { UserProfile } from '@/types/domain'

export interface SettingsFormLabels {
  title: string
  language: string
  languageHint: string
  timezone: string
  timezoneHint: string
  publicProfile: string
  saveError: string
  deleteTitle: string
  deleteDescription: string
  deleteAction: string
  deleteConfirm: string
}

type ProfileSettings = Partial<
  Pick<UserProfile, 'nativeLanguage' | 'uiLanguage' | 'timezone' | 'profilePublic'>
>

const selectClassName =
  'min-h-9 w-56 rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 text-sm text-[var(--ink)] transition-colors hover:border-[var(--mute)] focus-visible:border-[var(--mute)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none disabled:opacity-60 sm:w-72'

// Each setting is saved as soon as it changes, as on the profile page.
export function SettingsForm({
  labels,
  profile,
  timezones,
}: {
  labels: SettingsFormLabels
  profile: UserProfile
  timezones: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const currentLocale = useLocale()
  const [current, setCurrent] = useState(profile)
  // The language the page is shown in, which a profile from another device may not match yet.
  const [language, setLanguage] = useState<Locale>(isLocale(currentLocale) ? currentLocale : 'en')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  // A timezone saved before the list changed still shows as chosen.
  const timezoneOptions = timezones.includes(current.timezone)
    ? timezones
    : [current.timezone, ...timezones]

  async function save(update: ProfileSettings): Promise<boolean> {
    setBusy(true)
    setMessage('')
    try {
      setCurrent(
        await fetchApiData<UserProfile>('/api/v1/me/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        }),
      )
      return true
    } catch {
      setMessage(labels.saveError)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function changeLanguage(next: Locale) {
    const previous = language
    setLanguage(next)
    // One language is both the interface and the one words are explained in.
    if (await save({ nativeLanguage: next, uiLanguage: next })) {
      router.replace(pathname, { locale: next })
    } else {
      setLanguage(previous)
    }
  }

  async function deleteAccount() {
    if (!window.confirm(labels.deleteConfirm)) return
    const response = await fetch('/api/v1/me', { method: 'DELETE' })
    if (response.ok) router.push('/')
    else setMessage(labels.saveError)
  }

  return (
    <Card aria-labelledby="settings-heading">
      <h2 className="text-lg font-semibold" id="settings-heading">
        {labels.title}
      </h2>
      <div className="mt-2 divide-y divide-[var(--line)]">
        <SettingRow hint={labels.languageHint} label={labels.language} labelFor="settings-language">
          <select
            className={selectClassName}
            disabled={busy}
            id="settings-language"
            value={language}
            onChange={(event) => {
              if (isLocale(event.target.value)) void changeLanguage(event.target.value)
            }}
          >
            {locales.map((locale) => (
              <option key={locale} lang={locale} value={locale}>
                {localeNames[locale]}
              </option>
            ))}
          </select>
        </SettingRow>

        <SettingRow hint={labels.timezoneHint} label={labels.timezone} labelFor="settings-timezone">
          <select
            className={selectClassName}
            disabled={busy}
            id="settings-timezone"
            value={current.timezone}
            onChange={(event) => void save({ timezone: event.target.value })}
          >
            {timezoneOptions.map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </SettingRow>

        <SettingRow label={labels.publicProfile}>
          <Switch
            aria-label={labels.publicProfile}
            checked={current.profilePublic}
            disabled={busy}
            onCheckedChange={(checked) => void save({ profilePublic: checked })}
          />
        </SettingRow>

        <SettingRow hint={labels.deleteDescription} label={labels.deleteTitle}>
          <button
            className="rounded-lg border border-red-500 px-3 py-1.5 text-sm font-semibold text-red-700 dark:text-red-400"
            type="button"
            onClick={() => void deleteAccount()}
          >
            {labels.deleteAction}
          </button>
        </SettingRow>
      </div>
      <p aria-live="polite" className="text-sm text-red-700 dark:text-red-400">
        {message}
      </p>
    </Card>
  )
}
