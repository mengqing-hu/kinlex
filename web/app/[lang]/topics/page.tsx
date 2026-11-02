import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { config } from '@/lib/config'
import { isSupportedLanguage, supportedLanguageCodes } from '@/lib/languages'
import { listTopics } from '@/lib/services/topicService'
import { getPublicSupabase } from '@/lib/supabase/server'

export const revalidate = 3600

interface TopicsPageProps {
  params: Promise<{ lang: string }>
}

function getTopicsPath(language: string): string {
  return `/${encodeURIComponent(language)}/topics`
}

export function generateStaticParams() {
  return supportedLanguageCodes.map((lang) => ({ lang }))
}

export async function generateMetadata({ params }: TopicsPageProps): Promise<Metadata> {
  const { lang } = await params

  if (!isSupportedLanguage(lang)) {
    notFound()
  }

  const t = await getTranslations('topicsPage')
  const canonicalUrl = new URL(getTopicsPath(lang), config.siteUrl).toString()

  return {
    title: t('metadataTitle'),
    description: t('metadataDescription'),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'website',
      url: canonicalUrl,
      title: t('metadataTitle'),
      description: t('metadataDescription'),
    },
  }
}

export default async function TopicsPage({ params }: TopicsPageProps) {
  const { lang } = await params

  if (!isSupportedLanguage(lang)) {
    notFound()
  }

  const db = getPublicSupabase()
  const [topics, t] = await Promise.all([listTopics(db, lang), getTranslations('topicsPage')])

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold tracking-widest text-[var(--root)] uppercase">
          {t('eyebrow')}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--ink)] sm:text-5xl">
          {t('title')}
        </h1>
        <p className="mt-4 text-lg leading-8 text-[var(--mute)]">{t('description')}</p>
      </header>

      {topics.length > 0 ? (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => (
            <li key={topic.id}>
              <Link
                className="flex min-h-36 flex-col justify-between rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 transition-colors hover:border-[var(--root)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
                href={`${getTopicsPath(lang)}/${encodeURIComponent(topic.slug)}`}
              >
                <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">
                  {topic.name}
                </h2>
                <p className="mt-6 text-sm font-medium text-[var(--mute)]">
                  {t('wordCount', { count: topic.wordCount })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6 text-[var(--mute)]">
          {t('empty')}
        </p>
      )}
    </main>
  )
}
