import 'server-only'

import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { isSupportedLanguage, supportedLanguageCodes } from '@/lib/languages'

import { defaultLocale, type Locale } from './locales'
import { routing } from './routing'

// The learning language's name in the interface language, e.g. "Spanish" or "西班牙语", for
// text such as "Search {language} words".
export async function getLanguageName(language: string): Promise<string> {
  const t = await getTranslations('languageNames')
  return isSupportedLanguage(language) ? t(language) : language
}

// Every learning language's name in the interface language, by code.
export async function getLanguageNames(): Promise<Record<string, string>> {
  const t = await getTranslations('languageNames')
  return Object.fromEntries(supportedLanguageCodes.map((code) => [code, t(code)]))
}

// Pages and metadata under [locale] call this before reading any text, so they can still be
// built ahead as static pages. The layout has already turned away unknown languages.
export async function applyRouteLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params
  const resolved = hasLocale(routing.locales, locale) ? locale : defaultLocale
  setRequestLocale(resolved)
  return resolved
}
