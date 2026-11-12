import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { VideoStudy } from '@/components/videos/VideoStudy'
import { applyRouteLocale } from '@/i18n/server'
import { isSupportedLanguage } from '@/lib/languages'
import { getStudyVideo } from '@/lib/videos/studyFiles'
import { getWordListLabels } from '@/lib/wordListLabels'

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

  const [video, t, listLabels] = await Promise.all([
    getStudyVideo(lang, videoId, locale),
    getTranslations('videoPage'),
    getWordListLabels(),
  ])
  if (!video) notFound()

  return (
    <VideoStudy
      key={video.id}
      labels={{
        captions: t('captions'),
        original: t('original'),
        translation: t('translation'),
        inThisVideo: t('inThisVideo'),
        playSentence: t('playSentence'),
        dictionaryForm: t('dictionaryForm'),
        notInVocabulary: t('notInVocabulary'),
        close: listLabels.wordPanel.close,
        searchWords: t('searchWords'),
        noMatches: t('noMatches'),
        searchHint: t('searchHint'),
        inVocabulary: t('inVocabulary'),
        similarSpelling: t('similarSpelling'),
        wordPanel: listLabels.wordPanel,
      }}
      video={video}
    />
  )
}
