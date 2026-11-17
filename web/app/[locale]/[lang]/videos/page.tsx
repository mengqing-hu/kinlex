import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { AddVideoForm } from '@/components/videos/AddVideoForm'
import { VideoLibrary } from '@/components/videos/VideoLibrary'
import { localeNames, locales } from '@/i18n/locales'
import { applyRouteLocale, getLanguageNames } from '@/i18n/server'
import { isSupportedLanguage, supportedLanguages } from '@/lib/languages'
import { listUnfinishedVideoJobs } from '@/lib/videos/jobs'
import { listStudyVideos } from '@/lib/videos/studyFiles'
import { canUseVideos, currentUser } from '@/lib/videos/access'

// The study files change whenever the pipeline processes a video.
export const dynamic = 'force-dynamic'

interface VideosPageProps {
  params: Promise<{ locale: string; lang: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('videoPage')
  return { title: t('libraryTitle') }
}

export default async function VideosPage({ params }: VideosPageProps) {
  const { lang } = await params
  await applyRouteLocale(params)
  if (!isSupportedLanguage(lang)) notFound()
  if (!canUseVideos(await currentUser())) notFound()

  const [t, levelT, languageNames, processed, unfinished] = await Promise.all([
    getTranslations('videoPage'),
    getTranslations('levelPage'),
    getLanguageNames(),
    Promise.all(
      supportedLanguages.map(async ({ code }) => [code, await listStudyVideos(code)] as const),
    ),
    listUnfinishedVideoJobs(),
  ])

  // Every processed video, whatever the language being learned, by title.
  const videos = processed
    .flatMap(([code, list]) =>
      list.map((video) => ({
        id: video.id,
        href: `/${code}/videos/${video.id}`,
        language: code,
        languageName: languageNames[code] ?? code,
        title: video.title,
        meaningLanguageNames: video.meaningLanguages.map(
          (meaning) => localeNames[meaning as keyof typeof localeNames] ?? meaning,
        ),
      })),
    )
    .toSorted((left, right) => left.title.localeCompare(right.title))

  const addForm = (
    <AddVideoForm
      labels={{
        title: t('addTitle'),
        intro: t('addIntro'),
        link: t('link'),
        linkPlaceholder: t('linkPlaceholder'),
        invalidLink: t('invalidLink'),
        videoLanguage: t('videoLanguage'),
        meaningLanguage: t('meaningLanguage'),
        captionSource: t('captionSource'),
        captionSources: {
          official: t('captionSources.official'),
          automatic: t('captionSources.automatic'),
          whisper: t('captionSources.whisper'),
        },
        captionHints: {
          official: t('captionHints.official'),
          automatic: t('captionHints.automatic'),
          whisper: t('captionHints.whisper'),
        },
        captionUnavailable: t('captionUnavailable'),
        captionNeedsLink: t('captionNeedsLink'),
        captionChecking: t('captionChecking'),
        captionCheckFailed: t('captionCheckFailed'),
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
        done: t('done'),
        openVideo: t('openVideo'),
        dismiss: t('dismiss'),
        pause: t('pause'),
        resume: t('resume'),
        cancel: t('cancel'),
        paused: t('paused'),
        cancelConfirm: t.raw('cancelConfirm') as string,
        finishesAround: t.raw('finishesAround') as string,
        almostDone: t('almostDone'),
      }}
      language={lang}
      languages={supportedLanguages.map(({ code, name }) => ({
        code,
        name: languageNames[code] ?? name,
      }))}
      meaningLanguages={locales.map((code) => ({ code, name: localeNames[code] }))}
      processed={Object.fromEntries(processed)}
      unfinished={unfinished}
    />
  )

  return (
    <VideoLibrary
      addForm={addForm}
      addOpen={unfinished.length > 0}
      labels={{
        title: t('libraryTitle'),
        intro: t('libraryIntro'),
        addVideo: t('addTitle'),
        closeAdd: t('closeAdd'),
        empty: t('libraryEmpty'),
        explainedIn: t.raw('explainedIn') as string,
        views: {
          view: levelT('views.view'),
          list: levelT('views.list'),
          cards: levelT('views.cards'),
        },
        item: {
          videoOptions: t('videoOptions'),
          rename: t('renameVideo'),
          delete: t('deleteVideo'),
          deleteConfirm: t.raw('deleteVideoConfirm') as string,
        },
      }}
      videos={videos}
    />
  )
}
