import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { getTranslations } from 'next-intl/server'

import { WordList } from '@/components/list/WordList'
import { getWordListLabels } from '@/lib/wordListLabels'
import { config } from '@/lib/config'
import { NotFoundError, UnsupportedLanguageError } from '@/lib/errors'
import { supportedLanguageCodes } from '@/lib/languages'
import { getTopic, listTopics } from '@/lib/services/topicService'
import { listWordFilterOptions, listWords } from '@/lib/services/wordService'
import { getPublicSupabase } from '@/lib/supabase/server'

export const revalidate = 3600

const PAGE_SIZE = 20

interface TopicPageProps {
  params: Promise<{
    lang: string
    topic: string
  }>
}

function getTopicsPath(language: string): string {
  return `/${encodeURIComponent(language)}/topics`
}

function getTopicPath(language: string, topic: string): string {
  return `${getTopicsPath(language)}/${encodeURIComponent(topic)}`
}

const loadTopic = cache(async (language: string, slug: string) => {
  const db = getPublicSupabase()
  return getTopic(db, language, slug)
})

async function loadTopicOrNotFound(language: string, slug: string) {
  try {
    return await loadTopic(language, slug)
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof UnsupportedLanguageError) {
      notFound()
    }

    throw error
  }
}

export async function generateStaticParams() {
  const db = getPublicSupabase()
  const topicGroups = await Promise.all(
    supportedLanguageCodes.map(async (lang) => ({ lang, topics: await listTopics(db, lang) })),
  )

  return topicGroups.flatMap(({ lang, topics }) =>
    topics.map((topic) => ({ lang, topic: topic.slug })),
  )
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { lang, topic: slug } = await params
  const [topic, t] = await Promise.all([
    loadTopicOrNotFound(lang, slug),
    getTranslations('topicPage'),
  ])
  const canonicalUrl = new URL(getTopicPath(lang, topic.slug), config.siteUrl).toString()
  const title = t('metadataTitle', { topic: topic.name })
  const description = t('metadataDescription', { topic: topic.name })

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

export default async function TopicPage({ params }: TopicPageProps) {
  const { lang, topic: slug } = await params
  const topic = await loadTopicOrNotFound(lang, slug)
  const db = getPublicSupabase()

  const [initialPage, filterOptions, t, labels] = await Promise.all([
    listWords(db, { lang, explain: 'en', topic: topic.slug, limit: PAGE_SIZE }),
    listWordFilterOptions(db, lang),
    getTranslations('topicPage'),
    getWordListLabels(),
  ])

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <Link
        className="text-sm font-semibold text-[var(--mute)] hover:text-[var(--ink)]"
        href={getTopicsPath(lang)}
      >
        {t('allTopics')}
      </Link>

      <header className="mt-8 max-w-3xl">
        <p className="text-sm font-semibold tracking-widest text-[var(--root)] uppercase">
          {t('eyebrow')}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--ink)] sm:text-5xl">
          {t('title', { topic: topic.name })}
        </h1>
        <p className="mt-4 text-lg leading-8 text-[var(--mute)]">
          {t('description', { topic: topic.name })}
        </p>
      </header>

      <section className="mt-8" aria-label={t('title', { topic: topic.name })}>
        <WordList
          language={lang}
          topic={topic.slug}
          showTopicFilter={false}
          initialPage={initialPage}
          filterOptions={filterOptions}
          labels={labels}
        />
      </section>
    </main>
  )
}
