import { germanLanguage } from './de'
import { spanishLanguage } from './es'
import type { LanguageDefinition } from './types'

export const supportedLanguageCodes = ['de', 'es'] as const

export type SupportedLanguageCode = (typeof supportedLanguageCodes)[number]

export const supportedLanguages = [
  germanLanguage,
  spanishLanguage,
] as const satisfies readonly LanguageDefinition[]

export function isSupportedLanguage(language: string): language is SupportedLanguageCode {
  return supportedLanguageCodes.some((supportedLanguage) => supportedLanguage === language)
}

export function getLanguageDefinition(language: SupportedLanguageCode): LanguageDefinition {
  return supportedLanguages.find((definition) => definition.code === language) ?? germanLanguage
}
