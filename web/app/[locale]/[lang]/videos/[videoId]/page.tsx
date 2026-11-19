import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { VideoStudy } from '@/components/videos/VideoStudy'
import { applyRouteLocale } from '@/i18n/server'
import { isSupportedLanguage } from '@/lib/languages'
import { getVideoProgress } from '@/lib/videos/progress'
import { getStudyVideo } from '@/lib/videos/studyFiles'
import { getWordListLabels } from '@/lib/wordListLabels'
import { canUseVideos, currentUser } from '@/lib/videos/access'

export const dynamic = 'force-dynamic'

interface VideoPageProps {
  params: Promise<{ locale: string; lang: string; videoId: string }>
}

export async function generateMetadata({ params }: VideoPageProps): Promise<Metadata> {
  const { lang, videoId } = await params
  const locale = await applyRouteLocale(params)
  const video = isSupportedLanguage(lang) ? await getStudyVideo(lang, videoId, locale) : null
  return { title: video?.title }
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { lang, videoId } = await params
  const locale = await applyRouteLocale(params)
  if (!isSupportedLanguage(lang)) notFound()
  if (!canUseVideos(await currentUser())) notFound()

  const [video, progress, t, listLabels] = await Promise.all([
    getStudyVideo(lang, videoId, locale),
    getVideoProgress(videoId),
    getTranslations('videoPage'),
    getWordListLabels(lang),
  ])
  if (!video) notFound()

  return (
    <VideoStudy
      key={video.id}
      labels={{
        captions: t('captions'),
        options: t('options'),
        sidePanel: t('sidePanel'),
        original: t('original'),
        translation: t('translation'),
        inThisVideo: t('inThisVideo'),
        playSentence: t('playSentence'),
        sentenceSpeed: t('sentenceSpeed'),
        dictionaryForm: t('dictionaryForm'),
        notInVocabulary: t('notInVocabulary'),
        filtered: {
          name: t('filtered.name'),
          interjection: t('filtered.interjection'),
          foreign: t('filtered.foreign'),
          number: t('filtered.number'),
        },
        close: listLabels.wordPanel.close,
        searchWords: t('searchWords'),
        noMatches: t('noMatches'),
        searchHint: t('searchHint'),
        inVocabulary: t('inVocabulary'),
        similarSpelling: t('similarSpelling'),
        wordPanel: listLabels.wordPanel,
        chat: {
          chat: t('chat'),
          chatHint: t('chatHint'),
          chatPlaceholder: t('chatPlaceholder'),
          send: t('send'),
          chatFailed: t('chatFailed'),
          chatBusy: t('chatBusy'),
          close: listLabels.wordPanel.close,
        },
      }}
      progress={progress}
      video={video}
    />
  )
}
