import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { cache } from 'react'
import { getTranslations } from 'next-intl/server'

import { WordDetails, type WordDetailLabels } from '@/components/word/WordDetails'
import { WordViewTracker } from '@/components/activity/WordViewTracker'
import { WordHeader } from '@/components/word/WordHeader'
import { NotFoundError, UnsupportedLanguageError } from '@/lib/errors'
import { config } from '@/lib/config'
import { getWordDetail } from '@/lib/services/wordService'
import { getPublicSupabase } from '@/lib/supabase/server'
import { formatPartOfSpeech } from '@/lib/utils/partOfSpeech'

export const revalidate = 3600

interface WordPageProps {
  params: Promise<{
    lang: string
    slug: string
  }>
}

const loadWord = cache(async (language: string, slug: string) => {
  const db = getPublicSupabase()
  return getWordDetail(db, slug, { lang: language, explain: 'en' })
})

async function loadWordOrNotFound(language: string, slug: string) {
  try {
    return await loadWord(language, slug)
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof UnsupportedLanguageError) {
      notFound()
    }

    throw error
  }
}

function getCanonicalPath(language: string, slug: string): string {
  return `/${encodeURIComponent(language)}/word/${encodeURIComponent(slug)}`
}

export async function generateStaticParams() {
  const db = getPublicSupabase()
  const { data: words, error } = await db
    .from('words')
    .select('language, slug')
    .order('language', { ascending: true })
    .order('slug', { ascending: true })

  if (error) {
    throw new Error('Failed to load word paths', { cause: error })
  }

  return words.map((word) => ({ lang: word.language, slug: word.slug }))
}

export async function generateMetadata({ params }: WordPageProps): Promise<Metadata> {
  const { lang, slug } = await params
  const result = await loadWordOrNotFound(lang, slug)

  if (result.kind === 'redirect') {
    permanentRedirect(getCanonicalPath(lang, result.slug))
  }

  const t = await getTranslations('wordDetail')
  const canonicalPath = getCanonicalPath(lang, result.word.slug)
  const canonicalUrl = new URL(canonicalPath, config.siteUrl).toString()
  const description =
    result.word.glosses[0] ?? t('metadataDescription', { word: result.word.lemma })

  return {
    title: t('metadataTitle', { word: result.word.lemma }),
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'article',
      url: canonicalUrl,
      title: t('metadataTitle', { word: result.word.lemma }),
      description,
    },
  }
}

export default async function WordPage({ params }: WordPageProps) {
  const { lang, slug } = await params
  const result = await loadWordOrNotFound(lang, slug)

  if (result.kind === 'redirect') {
    permanentRedirect(getCanonicalPath(lang, result.slug))
  }

  const t = await getTranslations('wordDetail')
  const word = result.word
  const morphemeTypes = {
    prefix: t('morphemeTypes.prefix'),
    root: t('morphemeTypes.root'),
    suffix: t('morphemeTypes.suffix'),
  }
  const partsOfSpeech = t.raw('partsOfSpeech') as Record<string, string>
  const detailLabels: WordDetailLabels = {
    meaning: t('meaning'),
    structure: t('structure'),
    examples: t('examples'),
    wordFamily: t('wordFamily'),
    noExamples: t('noExamples'),
    noRelatedWords: t('noRelatedWords'),
    playExample: t('playExample'),
    slowAudio: t('slowAudio'),
    morphemeTypes,
    partsOfSpeech,
  }
  const canonicalUrl = new URL(getCanonicalPath(lang, word.slug), config.siteUrl).toString()
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: word.lemma,
    description: word.glosses.join('; '),
    inLanguage: lang,
    termCode: word.slug,
    url: canonicalUrl,
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-5 sm:px-8 sm:py-8">
      <article>
        <WordViewTracker language={lang} wordId={word.id} />
        <WordHeader
          language={lang}
          word={word}
          partOfSpeech={formatPartOfSpeech(partsOfSpeech, word.pos, word.posDetail)}
          levelLabel={word.level ? t('level', { level: word.level }) : null}
          pluralLabel={word.plural ? t('plural', { plural: word.plural }) : null}
          playLabel={t('playWord', { word: word.lemma })}
          slowLabel={t('slowAudio')}
          morphemeTypeLabels={morphemeTypes}
        />
        <WordDetails language={lang} word={word} labels={detailLabels} />
      </article>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replaceAll('<', '\\u003c'),
        }}
      />
    </main>
  )
}
