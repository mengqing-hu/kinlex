import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { AddVideoForm } from '@/components/videos/AddVideoForm'
import { localeNames, locales } from '@/i18n/locales'
import { applyRouteLocale } from '@/i18n/server'
import { isSupportedLanguage, supportedLanguages } from '@/lib/languages'
import { listStudyVideos } from '@/lib/videos/studyFiles'

// The study files change whenever the pipeline processes a video.
export const dynamic = 'force-dynamic'

interface VideosPageProps {
  params: Promise<{ locale: string; lang: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('videoPage')
  return { title: t('addTitle') }
}

export default async function VideosPage({ params }: VideosPageProps) {
  const { lang } = await params
  await applyRouteLocale(params)
  if (!isSupportedLanguage(lang)) notFound()

  const [t, processed] = await Promise.all([
    getTranslations('videoPage'),
    Promise.all(
      supportedLanguages.map(async ({ code }) => [code, await listStudyVideos(code)] as const),
    ),
  ])

  return (
    <AddVideoForm
      labels={{
        title: t('addTitle'),
        intro: t('addIntro'),
        link: t('link'),
        linkPlaceholder: t('linkPlaceholder'),
        invalidLink: t('invalidLink'),
        videoLanguage: t('videoLanguage'),
        meaningLanguage: t('meaningLanguage'),
        start: t('start'),
        processing: t('processing'),
        stages: {
          metadata: t('stages.metadata'),
          download: t('stages.download'),
          text: t('stages.text'),
          translation: t('stages.translation'),
          meanings: t('stages.meanings'),
          timing: t('stages.timing'),
        },
        failed: t('failed'),
        stopped: t('stopped'),
        startFailed: t('startFailed'),
        retry: t('retry'),
      }}
      language={lang}
      languages={supportedLanguages.map(({ code, name }) => ({ code, name }))}
      meaningLanguages={locales.map((code) => ({ code, name: localeNames[code] }))}
      processed={Object.fromEntries(processed)}
    />
  )
}
