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
          cardCount: t('cardCount'),
          stillLearning: t('stillLearning'),
          know: t('know'),
          progress: t.raw('progress') as string,
          flipHintBefore: t('flipHintBefore'),
          flipHintAfter: t('flipHintAfter'),
          space: t('space'),
          playWord: t.raw('playWord') as string,
          playExample: t('playExample'),
          slowAudio: t('slowAudio'),
          loading: t('loading'),
          loadError: t('loadError'),
          saveError: t('saveError'),
          retry: t('retry'),
          empty: t('empty'),
          roundDone: t('roundDone'),
          roundSummary: t.raw('roundSummary') as string,
          nextRound: t('nextRound'),
          noMeaning: t('noMeaning'),
          noRecording: t('noRecording'),
          partsOfSpeech: wordT.raw('partsOfSpeech') as Record<string, string>,
        }}
      />
    </main>
  )
}
