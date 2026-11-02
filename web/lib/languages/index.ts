import { germanLanguage } from './de'
import type { LanguageDefinition } from './types'

export const supportedLanguageCodes = ['de'] as const

export type SupportedLanguageCode = (typeof supportedLanguageCodes)[number]

export const supportedLanguages = [germanLanguage] as const satisfies readonly LanguageDefinition[]

export function isSupportedLanguage(language: string): language is SupportedLanguageCode {
  return supportedLanguageCodes.some((supportedLanguage) => supportedLanguage === language)
}

export function getLanguageDefinition(language: SupportedLanguageCode): LanguageDefinition {
  return supportedLanguages.find((definition) => definition.code === language) ?? germanLanguage
}
