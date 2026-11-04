import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { requireUser } from '@/app/me/requireUser'
import { WordList } from '@/components/list/WordList'
import { isSupportedLanguage } from '@/lib/languages'
import { listWordFilterOptions, listWords } from '@/lib/services/wordService'
import { getWordListLabels } from '@/lib/wordListLabels'

const PAGE_SIZE = 20

interface FavoritesPageProps {
  params: Promise<{ lang: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('favoritesPage')
  return { title: t('metadataTitle') }
}

export default async function FavoritesPage({ params }: FavoritesPageProps) {
  const { lang } = await params

  if (!isSupportedLanguage(lang)) {
    notFound()
  }

  const { supabase, user } = await requireUser(`/${lang}/favorites`)
  const [initialPage, filterOptions, t, labels] = await Promise.all([
    listWords(supabase, { lang, explain: 'en', favorites: true, limit: PAGE_SIZE }, user.id),
    listWordFilterOptions(supabase, lang, { favorites: true }, user.id),
    getTranslations('favoritesPage'),
    getWordListLabels(),
  ])

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <section aria-label={t('title')}>
        <WordList
          favoritesOnly
          language={lang}
          initialPage={initialPage}
          filterOptions={filterOptions}
          labels={{ ...labels, empty: t('empty') }}
        />
      </section>
    </main>
  )
}
