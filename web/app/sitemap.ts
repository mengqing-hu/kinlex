import type { MetadataRoute } from 'next'

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
      morphemes: await listMorphemes(supabase, language),
    })),
  )

  const staticEntries: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/search`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/credits`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/impressum`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${baseUrl}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ]

  const rootEntries: MetadataRoute.Sitemap = morphemeGroups.flatMap(({ language, morphemes }) => [
    {
      url: `${baseUrl}/${encodeURIComponent(language)}/roots`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    ...morphemes.map((morpheme) => ({
      url: `${baseUrl}/${encodeURIComponent(language)}/roots/${encodeURIComponent(morpheme.slug)}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ])

  return [...staticEntries, ...rootEntries]
}
