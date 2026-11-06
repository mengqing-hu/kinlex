import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { WordList } from '@/components/list/WordList'
import { getPathname, permanentRedirect } from '@/i18n/navigation'
import { applyRouteLocale } from '@/i18n/server'
import { getWordListLabels } from '@/lib/wordListLabels'
import { config } from '@/lib/config'
import { UnsupportedLanguageError } from '@/lib/errors'
import { supportedLanguageCodes } from '@/lib/languages'
import { listWordFilterOptions, listWords } from '@/lib/services/wordService'
import { getPublicSupabase } from '@/lib/supabase/server'
import { wordLevels } from '@/lib/validation/words'

export const revalidate = 3600

const PAGE_SIZE = 20

type WordLevel = (typeof wordLevels)[number]
const ALL_LEVELS_ROUTE = 'all'

interface LevelPageProps {
  params: Promise<{
    locale: string
    lang: string
    level: string
  }>
}

function parseLevel(value: string): WordLevel | null {
  const normalizedLevel = value.toUpperCase()
  return wordLevels.find((level) => level === normalizedLevel) ?? null
}

function getLevelPath(language: string, level: string): string {
  return `/${encodeURIComponent(language)}/vocabulary/${level.toLowerCase()}`
}

export function generateStaticParams() {
  return supportedLanguageCodes.flatMap((language) =>
    [ALL_LEVELS_ROUTE, ...wordLevels.map((level) => level.toLowerCase())].map((level) => ({
      lang: language,
      level,
    })),
  )
}

export async function generateMetadata({ params }: LevelPageProps): Promise<Metadata> {
  const { lang, level: rawLevel } = await params
  const locale = await applyRouteLocale(params)
  const isAllLevels = rawLevel.toLowerCase() === ALL_LEVELS_ROUTE
  const level = isAllLevels ? undefined : parseLevel(rawLevel)

  if (!supportedLanguageCodes.some((language) => language === lang) || (!isAllLevels && !level)) {
    notFound()
  }

  const t = await getTranslations('levelPage')
  const canonicalUrl = new URL(
    getPathname({ href: getLevelPath(lang, level ?? ALL_LEVELS_ROUTE), locale }),
    config.siteUrl,
  ).toString()
  const title = level ? t('metadataTitle', { level }) : t('allLevelsMetadataTitle')
  const description = level
    ? t('metadataDescription', { level })
    : t('allLevelsMetadataDescription')

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'website',
      url: canonicalUrl,
      title,
      description,
    },
  }
}

export default async function LevelPage({ params }: LevelPageProps) {
  const { lang, level: rawLevel } = await params
  const locale = await applyRouteLocale(params)
  const isAllLevels = rawLevel.toLowerCase() === ALL_LEVELS_ROUTE
  const parsedLevel = parseLevel(rawLevel)

  if (!isAllLevels && !parsedLevel) {
    notFound()
  }
  const level: WordLevel | undefined = isAllLevels ? undefined : (parsedLevel ?? undefined)

  const normalizedLevel = level?.toLowerCase() ?? ALL_LEVELS_ROUTE
  if (rawLevel !== normalizedLevel) {
    permanentRedirect({ href: getLevelPath(lang, normalizedLevel), locale })
  }

  const db = getPublicSupabase()

  let initialPage
  let filterOptions
  try {
    ;[initialPage, filterOptions] = await Promise.all([
      listWords(db, { lang, explain: 'en', level, limit: PAGE_SIZE }),
      listWordFilterOptions(db, lang, { level }),
    ])
  } catch (error) {
    if (error instanceof UnsupportedLanguageError) {
      notFound()
    }

    throw error
  }

  const [t, labels] = await Promise.all([getTranslations('levelPage'), getWordListLabels()])
  const pageTitle = level ? t('title', { level }) : t('allLevelsTitle')

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <section aria-label={pageTitle}>
        <WordList
          language={lang}
          level={level}
          showLevelFilter
          initialPage={initialPage}
          filterOptions={filterOptions}
          labels={labels}
        />
      </section>
    </main>
  )
}
