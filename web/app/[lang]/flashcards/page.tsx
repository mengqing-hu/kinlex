import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { requireUser } from '@/app/me/requireUser'
import { FlashcardSession } from '@/components/flashcards/FlashcardSession'
import { isSupportedLanguage } from '@/lib/languages'

interface FlashcardsPageProps {
  params: Promise<{ lang: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('flashcardsPage')
  return { title: t('metadataTitle') }
}

export default async function FlashcardsPage({ params }: FlashcardsPageProps) {
  const { lang } = await params

  if (!isSupportedLanguage(lang)) {
    notFound()
  }

  await requireUser(`/${lang}/flashcards`)
  const [t, wordT] = await Promise.all([
    getTranslations('flashcardsPage'),
    getTranslations('wordDetail'),
  ])

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
      <FlashcardSession
        language={lang}
        labels={{
          title: t('title'),
          stillLearning: t('stillLearning'),
          know: t('know'),
          progress: t.raw('progress') as string,
          flipHintBefore: t('flipHintBefore'),
          flipHintAfter: t('flipHintAfter'),
          space: t('space'),
          loading: t('loading'),
          loadError: t('loadError'),
          saveError: t('saveError'),
          retry: t('retry'),
          empty: t('empty'),
          emptyAction: t('emptyAction'),
          roundDone: t('roundDone'),
          roundSummary: t.raw('roundSummary') as string,
          nextRound: t('nextRound'),
          face: {
            playWord: t.raw('face.playWord') as string,
            playExample: t('face.playExample'),
            slowAudio: t('face.slowAudio'),
            noMeaning: t('face.noMeaning'),
            noRecording: t('face.noRecording'),
            partsOfSpeech: wordT.raw('partsOfSpeech') as Record<string, string>,
          },
          settings: {
            settings: t('settings.title'),
            wordsSection: t('settings.wordsSection'),
            wordsHint: t('settings.wordsHint'),
            source: t('settings.source'),
            sources: {
              all: t('settings.sources.all'),
              favorites: t('settings.sources.favorites'),
              learning: t('settings.sources.learning'),
            },
            levels: t('settings.levels'),
            levelsHint: t('settings.levelsHint'),
            cardCount: t('settings.cardCount'),
            cardCountHint: t.raw('settings.cardCountHint') as string,
            startRound: t('settings.startRound'),
            cardSection: t('settings.cardSection'),
            direction: t('settings.direction'),
            directions: {
              'de-en': t('settings.directions.de-en'),
              'en-de': t('settings.directions.en-de'),
              mixed: t('settings.directions.mixed'),
            },
            showExample: t('settings.showExample'),
            showExampleMeaning: t('settings.showExampleMeaning'),
            autoplay: t('settings.autoplay'),
          },
        }}
      />
    </main>
  )
}
