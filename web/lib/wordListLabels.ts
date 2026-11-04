import 'server-only'

import { getTranslations } from 'next-intl/server'

import type { WordListLabels } from '@/components/list/WordList'

export async function getWordListLabels(): Promise<WordListLabels> {
  const [t, wordT, morphemeT] = await Promise.all([
    getTranslations('levelPage'),
    getTranslations('wordDetail'),
    getTranslations('morphemeCard'),
  ])

  return {
    allLevels: t('allLevels'),
    level: t('levelFilter'),
    allPartsOfSpeech: t('allPartsOfSpeech'),
    partOfSpeech: t('partOfSpeech'),
    allTopics: t('allTopics'),
    topic: t('topic'),
    searchWords: t('searchWords'),
    searchPlaceholder: t('searchPlaceholder'),
    hideMeanings: t('hideMeanings'),
    showMeanings: t('showMeanings'),
    sort: t('sort'),
    sortDefault: t('sortDefault'),
    sortFamiliarityAsc: t('sortFamiliarityAsc'),
    sortFamiliarityDesc: t('sortFamiliarityDesc'),
    sortSignInHint: t('sortSignInHint'),
    hideActions: t('hideActions'),
    showActions: t('showActions'),
    loadMore: t('loadMore'),
    loading: t('loading'),
    empty: t('empty'),
    loadError: t('loadError'),
    retry: t('retry'),
    playWord: t.raw('playWord') as string,
    playExample: t('playExample'),
    slowAudio: t('slowAudio'),
    hideWord: t('hideWord'),
    showWord: t('showWord'),
    familiarity: t.raw('familiarity') as string,
    openWord: t.raw('openWord') as string,
    morphemeTypes: {
      prefix: wordT('morphemeTypes.prefix'),
      root: wordT('morphemeTypes.root'),
      suffix: wordT('morphemeTypes.suffix'),
    },
    partsOfSpeech: wordT.raw('partsOfSpeech') as Record<string, string>,
    morphemeCard: {
      loading: morphemeT('loading'),
      loadError: morphemeT('loadError'),
      retry: morphemeT('retry'),
      relatedWords: morphemeT('relatedWords'),
      noRelatedWords: morphemeT('noRelatedWords'),
      separable: morphemeT('separable'),
    },
  }
}
