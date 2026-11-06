import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { RootDirectory, type RootDirectoryLabels } from '@/components/root/RootDirectory'
import { getPathname } from '@/i18n/navigation'
import { applyRouteLocale } from '@/i18n/server'
import { config } from '@/lib/config'
import { isSupportedLanguage, supportedLanguageCodes } from '@/lib/languages'
import { listMorphemes } from '@/lib/services/morphemeService'
import { getWordListLabels } from '@/lib/wordListLabels'
import { getPublicSupabase } from '@/lib/supabase/server'

export const revalidate = 3600

interface RootsPageProps {
  params: Promise<{ locale: string; lang: string }>
}

export function generateStaticParams() {
  return supportedLanguageCodes.map((lang) => ({ lang }))
}

export async function generateMetadata({ params }: RootsPageProps): Promise<Metadata> {
  const { lang } = await params
  const locale = await applyRouteLocale(params)
  if (!isSupportedLanguage(lang)) notFound()

  const t = await getTranslations('rootsPage')
  const canonicalUrl = new URL(
    getPathname({ href: `/${lang}/word-parts`, locale }),
    config.siteUrl,
  ).toString()
  return {
    title: t('metadataTitle'),
    description: t('metadataDescription'),
    alternates: { canonical: canonicalUrl },
  }
}

export default async function RootsPage({ params }: RootsPageProps) {
  const { lang } = await params
  await applyRouteLocale(params)
  if (!isSupportedLanguage(lang)) notFound()

  const [items, t, listLabels] = await Promise.all([
    listMorphemes(getPublicSupabase(), lang),
    getTranslations('rootsPage'),
    getWordListLabels(),
  ])

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <RootDirectory
        items={items}
        language={lang}
        labels={{
          allTypes: t('allTypes'),
          empty: t('empty'),
          morphemePanel: {
            close: listLabels.wordPanel.close,
            loading: listLabels.morphemeCard.loading,
            loadError: listLabels.morphemeCard.loadError,
            retry: listLabels.morphemeCard.retry,
            meaning: listLabels.wordPanel.meaning,
            words: t('panel.words'),
            noWords: t('panel.noWords'),
            separable: listLabels.morphemeCard.separable,
            openList: t('panel.openList'),
            morphemeTypes: listLabels.morphemeTypes,
            partsOfSpeech: listLabels.partsOfSpeech,
          },
          type: t('type'),
          noMatches: t('noMatches'),
          search: t('search'),
          searchPlaceholder: t('searchPlaceholder'),
          types: {
            prefix: t('types.prefix'),
            root: t('types.root'),
            suffix: t('types.suffix'),
          },
          sorting: {
            sort: t('sorting.sort'),
            sortBy: t('sorting.sortBy'),
            default: t('sorting.default'),
            reverse: t('sorting.reverse'),
            sorts: t.raw('sorting.sorts') as RootDirectoryLabels['sorting']['sorts'],
            orders: t.raw('sorting.orders') as RootDirectoryLabels['sorting']['orders'],
          },
          views: {
            view: t('views.view'),
            list: t('views.list'),
            cards: t('views.cards'),
          },
          word: t('word'),
          wordPanel: listLabels.wordPanel,
          words: t('words'),
        }}
      />
    </main>
  )
}
