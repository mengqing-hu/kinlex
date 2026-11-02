import type { MetadataRoute } from 'next'

import { config } from '@/lib/config'
import { supportedLanguageCodes } from '@/lib/languages'
import { listMorphemes } from '@/lib/services/morphemeService'
import { listTopics } from '@/lib/services/topicService'
import { getSupabase } from '@/lib/supabase/server'

const baseUrl = config.siteUrl.replace(/\/$/, '')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await getSupabase()
  const [{ data: words, error }, topicGroups, morphemeGroups] = await Promise.all([
    supabase
      .from('words')
      .select('language, slug, updated_at')
      .eq('status', 'published')
      .order('updated_at', { ascending: false }),
    Promise.all(
      supportedLanguageCodes.map(async (language) => ({
        language,
        topics: await listTopics(supabase, language),
      })),
    ),
    Promise.all(
      supportedLanguageCodes.map(async (language) => ({
        language,
        morphemes: await listMorphemes(supabase, language),
      })),
    ),
  ])

  if (error) {
    throw new Error('Failed to load published words for the sitemap', { cause: error })
  }

  const staticEntries: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/search`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/credits`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/impressum`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${baseUrl}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ]

  const wordEntries: MetadataRoute.Sitemap = words.map((word) => ({
    url: `${baseUrl}/${encodeURIComponent(word.language)}/word/${encodeURIComponent(word.slug)}`,
    lastModified: word.updated_at,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const topicEntries: MetadataRoute.Sitemap = topicGroups.flatMap(({ language, topics }) => [
    {
      url: `${baseUrl}/${encodeURIComponent(language)}/topics`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    ...topics.map((topic) => ({
      url: `${baseUrl}/${encodeURIComponent(language)}/topics/${encodeURIComponent(topic.slug)}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ])

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

  return [...staticEntries, ...topicEntries, ...rootEntries, ...wordEntries]
}
