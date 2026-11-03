import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { getTranslations } from 'next-intl/server'

import { WordList, type WordListLabels } from '@/components/list/WordList'
import { config } from '@/lib/config'
import { NotFoundError, UnsupportedLanguageError } from '@/lib/errors'
import { supportedLanguageCodes } from '@/lib/languages'
import { getMorphemeBySlug, listMorphemes } from '@/lib/services/morphemeService'
import { listWordFilterOptions, listWords } from '@/lib/services/wordService'
import { getPublicSupabase } from '@/lib/supabase/server'

export const revalidate = 3600
const PAGE_SIZE = 20

interface RootPageProps {
  params: Promise<{ lang: string; root: string }>
}

const loadMorpheme = cache((language: string, slug: string) =>
  getMorphemeBySlug(getPublicSupabase(), language, slug),
)

async function loadMorphemeOrNotFound(language: string, slug: string) {
  try {
    return await loadMorpheme(language, slug)
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof UnsupportedLanguageError) notFound()
    throw error
  }
}

export async function generateStaticParams() {
  const db = getPublicSupabase()
  const groups = await Promise.all(
    supportedLanguageCodes.map(async (lang) => ({ lang, items: await listMorphemes(db, lang) })),
  )
  return groups.flatMap(({ lang, items }) => items.map((item) => ({ lang, root: item.slug })))
}

export async function generateMetadata({ params }: RootPageProps): Promise<Metadata> {
  const { lang, root } = await params
  const [morpheme, t] = await Promise.all([
    loadMorphemeOrNotFound(lang, root),
    getTranslations('rootPage'),
  ])
  const canonicalUrl = new URL(`/${lang}/roots/${morpheme.slug}`, config.siteUrl).toString()
  return {
    title: t('metadataTitle', { root: morpheme.text }),
    description: t('metadataDescription', { root: morpheme.text, meaning: morpheme.meaning }),
    alternates: { canonical: canonicalUrl },
  }
}

export default async function RootPage({ params }: RootPageProps) {
  const { lang, root } = await params
  const morpheme = await loadMorphemeOrNotFound(lang, root)
  const db = getPublicSupabase()
  const [initialPage, filterOptions, t, listT, wordT, morphemeT] = await Promise.all([
    listWords(db, { lang, explain: 'en', morpheme: morpheme.slug, limit: PAGE_SIZE }),
    listWordFilterOptions(db, lang),
    getTranslations('rootPage'),
    getTranslations('levelPage'),
    getTranslations('wordDetail'),
    getTranslations('morphemeCard'),
  ])
  const labels: WordListLabels = {
    allLevels: listT('allLevels'),
    level: listT('levelFilter'),
    allPartsOfSpeech: listT('allPartsOfSpeech'),
    partOfSpeech: listT('partOfSpeech'),
    allTopics: listT('allTopics'),
    topic: listT('topic'),
    searchWords: listT('searchWords'),
    searchPlaceholder: listT('searchPlaceholder'),
    hideMeanings: listT('hideMeanings'),
    showMeanings: listT('showMeanings'),
    sort: listT('sort'),
    sortDefault: listT('sortDefault'),
    sortFamiliarityAsc: listT('sortFamiliarityAsc'),
    sortFamiliarityDesc: listT('sortFamiliarityDesc'),
    sortSignInHint: listT('sortSignInHint'),
    hideActions: listT('hideActions'),
    showActions: listT('showActions'),
    loadMore: listT('loadMore'),
    loading: listT('loading'),
    empty: listT('empty'),
    loadError: listT('loadError'),
    retry: listT('retry'),
    playWord: listT.raw('playWord') as string,
    playExample: listT('playExample'),
    slowAudio: listT('slowAudio'),
    hideWord: listT('hideWord'),
    showWord: listT('showWord'),
    familiarity: listT.raw('familiarity') as string,
    openWord: listT.raw('openWord') as string,
    morphemeTypes: {
      prefix: wordT('morphemeTypes.prefix'),
      root: wordT('morphemeTypes.root'),
      suffix: wordT('morphemeTypes.suffix'),
    },
    partsOfSpeech: wordT.raw('partsOfSpeech') as Record<string, string>,
    morphemeCard: {
      loading: morphemeT('loading'),
      loadError: morphemeT('loadError'),
      retry: morphemeT('retry'),
      relatedWords: morphemeT('relatedWords'),
      noRelatedWords: morphemeT('noRelatedWords'),
      separable: morphemeT('separable'),
    },
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <Link
        className="text-sm font-semibold text-[var(--mute)] hover:text-[var(--ink)]"
        href={`/${lang}/roots`}
      >
        {t('allRoots')}
      </Link>
      <header className="mt-8 max-w-3xl">
        <p className="text-sm font-semibold tracking-widest text-[var(--root)] uppercase">
          {t(`types.${morpheme.type}`)}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{morpheme.text}</h1>
        <p className="mt-4 text-lg leading-8 text-[var(--mute)]">{morpheme.meaning}</p>
        {morpheme.separable ? <p className="mt-3 text-sm font-semibold">{t('separable')}</p> : null}
      </header>
      <section className="mt-8" aria-label={t('words', { root: morpheme.text })}>
        <WordList
          filterOptions={filterOptions}
          initialPage={initialPage}
          labels={labels}
          language={lang}
          morpheme={morpheme.slug}
        />
      </section>
    </main>
  )
}
