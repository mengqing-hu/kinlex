import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'

import englishMessages from '@/messages/en.json'

import { defaultLocale, getMessageLocale } from './locales'
import { routing } from './routing'

type Messages = { [key: string]: string | Messages }

// Text not yet translated into a language shows in English rather than as a missing key.
function withFallback(messages: Messages, fallback: Messages): Messages {
  const merged: Messages = { ...fallback }
  for (const [key, value] of Object.entries(messages)) {
    const fallbackValue = fallback[key]
    merged[key] =
      typeof value === 'object' && typeof fallbackValue === 'object'
        ? withFallback(value, fallbackValue)
        : value
  }
  return merged
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : defaultLocale
  const messageLocale = getMessageLocale(locale)
  const messages =
    messageLocale === defaultLocale
      ? englishMessages
      : withFallback(
          (await import(`@/messages/${messageLocale}.json`)).default as Messages,
          englishMessages as Messages,
        )

  return { locale, messages }
})
