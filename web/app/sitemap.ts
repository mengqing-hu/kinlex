import type { MetadataRoute } from 'next'

import { translatedLocales } from '@/i18n/locales'
import { config } from '@/lib/config'
import { supportedLanguageCodes } from '@/lib/languages'
import { listMorphemes } from '@/lib/services/morphemeService'
import { getSupabase } from '@/lib/supabase/server'

const baseUrl = config.siteUrl.replace(/\/$/, '')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await getSupabase()
  // Words have no pages of their own; they open in the side panel of the level lists.
  const morphemeGroups = await Promise.all(
    supportedLanguageCodes.map(async (language) => ({
      language,
      morphemes: await listMorphemes(supabase, language, 'en'),
    })),
  )

  // Only languages with their own interface text are listed; the others repeat the English pages.
  return translatedLocales.flatMap((locale): MetadataRoute.Sitemap => {
    const localeUrl = `${baseUrl}/${locale}`
    return [
      { url: localeUrl, changeFrequency: 'daily', priority: 1 },
      { url: `${localeUrl}/credits`, changeFrequency: 'monthly', priority: 0.3 },
      { url: `${localeUrl}/impressum`, changeFrequency: 'yearly', priority: 0.2 },
      { url: `${localeUrl}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
      ...morphemeGroups.flatMap(({ language, morphemes }) => [
        {
          url: `${localeUrl}/${encodeURIComponent(language)}/word-parts`,
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        },
        ...morphemes.map((morpheme) => ({
          url: `${localeUrl}/${encodeURIComponent(language)}/word-parts/${encodeURIComponent(morpheme.slug)}`,
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        })),
      ]),
    ]
  })
}
