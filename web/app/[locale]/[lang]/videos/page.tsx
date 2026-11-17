import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { VideoLibrary } from '@/components/videos/VideoLibrary'
import { VideoToolbar } from '@/components/videos/VideoToolbar'
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

  // Every processed video, whatever the language being learned; the library sorts them.
  const videos = processed.flatMap(([code, list]) =>
    list.map((video) => ({
      id: video.id,
      href: `/${code}/videos/${video.id}`,
      language: code,
      languageName: languageNames[code] ?? code,
      title: video.title,
      meaningLanguageNames: video.meaningLanguages.map(
        (meaning) => localeNames[meaning as keyof typeof localeNames] ?? meaning,
      ),
      addedAt: video.addedAt,
      durationMs: video.durationMs,
    })),
  )

  const toolbar = (
    <VideoToolbar
      labels={{
        toolbarTitle: t('libraryTitle'),
        title: t('addTitle'),
        progress: t('progress'),
        noJobs: t('noJobs'),
        close: t('close'),
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
      toolbar={toolbar}
      // eslint-disable-next-line react-hooks/purity -- the page is made anew for every request.
      now={Date.now()}
      labels={{
        title: t('libraryTitle'),
        empty: t('libraryEmpty'),
        noMatches: t('libraryNoMatches'),
        search: t('searchVideos'),
        searchPlaceholder: t('searchVideosPlaceholder'),
        language: t('filters.language'),
        allLanguages: t('filters.allLanguages'),
        added: t('filters.added'),
        addedAnyTime: t('filters.addedAnyTime'),
        addedRanges: {
          7: t('filters.addedRanges.7'),
          30: t('filters.addedRanges.30'),
          90: t('filters.addedRanges.90'),
        },
        duration: t('filters.duration'),
        anyDuration: t('filters.anyDuration'),
        durationRanges: {
          short: t('filters.durationRanges.short'),
          medium: t('filters.durationRanges.medium'),
          long: t('filters.durationRanges.long'),
        },
        sorting: {
          sort: levelT('sorting.sort'),
          sortBy: levelT('sorting.sortBy'),
          default: levelT('sorting.default'),
          reverse: levelT('sorting.reverse'),
          sorts: {
            added: t('sorting.added'),
            duration: t('sorting.duration'),
            title: t('sorting.title'),
          },
          orders: {
            added: { asc: t('sorting.addedAsc'), desc: t('sorting.addedDesc') },
            duration: { asc: t('sorting.durationAsc'), desc: t('sorting.durationDesc') },
            title: { asc: t('sorting.titleAsc'), desc: t('sorting.titleDesc') },
          },
        },
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
