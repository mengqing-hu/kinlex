import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { GrammarDirectory } from '@/components/grammar/GrammarDirectory'
import { loadGrammarBook } from '@/lib/grammar/loadBook'
import { isSupportedLanguage } from '@/lib/languages'
import { getWordListLabels } from '@/lib/wordListLabels'

interface GrammarPageProps {
  params: Promise<{ lang: string }>
}

export async function generateMetadata({ params }: GrammarPageProps): Promise<Metadata> {
  const { lang } = await params
  if (!isSupportedLanguage(lang) || !(await loadGrammarBook(lang))) notFound()

  const t = await getTranslations('grammarPage')
  // The grammar is copied from a textbook for personal study, so it stays out of search engines.
  return { title: t('metadataTitle'), robots: { index: false, follow: false } }
}

export default async function GrammarPage({ params }: GrammarPageProps) {
  const { lang } = await params
  if (!isSupportedLanguage(lang)) notFound()
  const [t, listLabels, book] = await Promise.all([
    getTranslations('grammarPage'),
    getWordListLabels(),
    loadGrammarBook(lang),
  ])
  if (!book) notFound()
  const { contents, details } = book

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <GrammarDirectory
        contents={contents}
        details={details}
        language={lang}
        labels={{
          allChapters: t('allChapters'),
          chapter: t('chapter'),
          empty: t('empty'),
          introduction: t('introduction'),
          noMatches: t('noMatches'),
          panel: {
            cases: {
              nom: t('panel.cases.nom'),
              akk: t('panel.cases.akk'),
              dat: t('panel.cases.dat'),
              gen: t('panel.cases.gen'),
            },
            close: listLabels.wordPanel.close,
            learnFirst: t('panel.learnFirst'),
            next: t('panel.next'),
            nextTopic: t('panel.nextTopic'),
            noContent: t('panel.noContent'),
            previousTopic: t('panel.previousTopic'),
            related: t('panel.related'),
          },
          search: t('search'),
          searchPlaceholder: t('searchPlaceholder'),
          subsection: t('subsection'),
          subsections: t('subsections'),
          views: {
            view: t('views.view'),
            list: t('views.list'),
            cards: t('views.cards'),
          },
          wordPanel: listLabels.wordPanel,
        }}
      />
    </main>
  )
}
