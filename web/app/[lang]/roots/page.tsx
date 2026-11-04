import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { RootDirectory } from '@/components/root/RootDirectory'
import { config } from '@/lib/config'
import { isSupportedLanguage, supportedLanguageCodes } from '@/lib/languages'
import { listMorphemes } from '@/lib/services/morphemeService'
import { getPublicSupabase } from '@/lib/supabase/server'

export const revalidate = 3600

interface RootsPageProps {
  params: Promise<{ lang: string }>
}

export function generateStaticParams() {
  return supportedLanguageCodes.map((lang) => ({ lang }))
}

export async function generateMetadata({ params }: RootsPageProps): Promise<Metadata> {
  const { lang } = await params
  if (!isSupportedLanguage(lang)) notFound()

  const t = await getTranslations('rootsPage')
  const canonicalUrl = new URL(`/${lang}/roots`, config.siteUrl).toString()
  return {
    title: t('metadataTitle'),
    description: t('metadataDescription'),
    alternates: { canonical: canonicalUrl },
  }
}

export default async function RootsPage({ params }: RootsPageProps) {
  const { lang } = await params
  if (!isSupportedLanguage(lang)) notFound()

  const [items, t] = await Promise.all([
    listMorphemes(getPublicSupabase(), lang),
    getTranslations('rootsPage'),
  ])

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <RootDirectory
        items={items}
        language={lang}
        labels={{
          empty: t('empty'),
          types: {
            prefix: t('types.prefix'),
            root: t('types.root'),
            suffix: t('types.suffix'),
          },
          word: t('word'),
          words: t('words'),
        }}
      />
    </main>
  )
}
