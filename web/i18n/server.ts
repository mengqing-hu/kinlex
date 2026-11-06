import 'server-only'

import { hasLocale } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'

import { defaultLocale, type Locale } from './locales'
import { routing } from './routing'

// Pages and metadata under [locale] call this before reading any text, so they can still be
// built ahead as static pages. The layout has already turned away unknown languages.
export async function applyRouteLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params
  const resolved = hasLocale(routing.locales, locale) ? locale : defaultLocale
  setRequestLocale(resolved)
  return resolved
}
