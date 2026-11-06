// The languages a learner can use the site in: the interface and the meanings of words both
// follow this choice. Each is named in its own language so a learner can find theirs.
export const locales = [
  'en',
  'zh',
  'hi',
  'es',
  'fr',
  'ar',
  'bn',
  'ru',
  'pt',
  'ur',
  'id',
  'de',
  'ja',
  'vi',
  'ko',
  'th',
  'ms',
] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeNames: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  hi: 'हिन्दी',
  es: 'Español',
  fr: 'Français',
  ar: 'العربية',
  bn: 'বাংলা',
  ru: 'Русский',
  pt: 'Português',
  ur: 'اردو',
  id: 'Bahasa Indonesia',
  de: 'Deutsch',
  ja: '日本語',
  vi: 'Tiếng Việt',
  ko: '한국어',
  th: 'ไทย',
  ms: 'Bahasa Melayu',
}

// The languages with their own interface text in messages/. The others show English until
// theirs is written, and their pages are rendered on first visit instead of at build time.
export const translatedLocales = ['en', 'zh'] as const satisfies readonly Locale[]

const rightToLeftLocales: readonly Locale[] = ['ar', 'ur']

export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value)
}

// The language the interface text is actually shown in, which sets the page's lang and direction.
export function getMessageLocale(locale: Locale): Locale {
  return translatedLocales.some((translated) => translated === locale) ? locale : defaultLocale
}

export function getTextDirection(locale: Locale): 'ltr' | 'rtl' {
  return rightToLeftLocales.includes(locale) ? 'rtl' : 'ltr'
}
