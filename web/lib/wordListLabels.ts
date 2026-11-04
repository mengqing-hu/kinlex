import 'server-only'

import { getTranslations } from 'next-intl/server'

import type { SortSelectLabels } from '@/components/list/SortSelect'
import type { WordListLabels } from '@/components/list/WordList'

export async function getWordListLabels(): Promise<WordListLabels> {
  const [t, wordT, morphemeT] = await Promise.all([
    getTranslations('levelPage'),
    getTranslations('wordDetail'),
    getTranslations('morphemeCard'),
  ])

  const morphemeTypes = {
    prefix: wordT('morphemeTypes.prefix'),
    root: wordT('morphemeTypes.root'),
    suffix: wordT('morphemeTypes.suffix'),
  }
  const partsOfSpeech = wordT.raw('partsOfSpeech') as Record<string, string>

  return {
    allLevels: t('allLevels'),
    level: t('levelFilter'),
    allPartsOfSpeech: t('allPartsOfSpeech'),
    partOfSpeech: t('partOfSpeech'),
    allTopics: t('allTopics'),
    topic: t('topic'),
    otherTopic: t('otherTopic'),
    otherTopicHint: t('otherTopicHint'),
    searchWords: t('searchWords'),
    searchPlaceholder: t('searchPlaceholder'),
    views: {
      view: t('views.view'),
      list: t('views.list'),
      cards: t('views.cards'),
    },
    listOptions: {
      listOptions: t('listOptions.listOptions'),
      testYourself: t('listOptions.testYourself'),
      off: t('listOptions.off'),
      hideWord: t('listOptions.hideWord'),
      hideMeaning: t('listOptions.hideMeaning'),
      display: t('listOptions.display'),
      showActions: t('listOptions.showActions'),
      actionsHidden: t('listOptions.actionsHidden'),
      thisList: t('listOptions.thisList'),
      resetFamiliarity: t('listOptions.resetFamiliarity'),
      clearFavorites: t('listOptions.clearFavorites'),
      confirmResetFamiliarity: t.raw('listOptions.confirmResetFamiliarity') as string,
      confirmClearFavorites: t.raw('listOptions.confirmClearFavorites') as string,
      cancel: t('listOptions.cancel'),
      reset: t('listOptions.reset'),
      remove: t('listOptions.remove'),
      familiarityReset: t.raw('listOptions.familiarityReset') as string,
      favoritesCleared: t.raw('listOptions.favoritesCleared') as string,
      resetFailed: t.raw('listOptions.resetFailed') as string,
    },
    sorting: {
      sort: t('sorting.sort'),
      sortBy: t('sorting.sortBy'),
      reverse: t('sorting.reverse'),
      signInHint: t('sorting.signInHint'),
      sorts: t.raw('sorting.sorts') as SortSelectLabels['sorts'],
      orders: t.raw('sorting.orders') as SortSelectLabels['orders'],
    },
    loadMore: t('loadMore'),
    loading: t('loading'),
    empty: t('empty'),
    loadError: t('loadError'),
    retry: t('retry'),
    playWord: t.raw('playWord') as string,
    playExample: t('playExample'),
    slowAudio: t('slowAudio'),
    familiarity: t.raw('familiarity') as string,
    openWord: t.raw('openWord') as string,
    morphemeTypes,
    partsOfSpeech,
    morphemeCard: {
      loading: morphemeT('loading'),
      loadError: morphemeT('loadError'),
      retry: morphemeT('retry'),
      relatedWords: morphemeT('relatedWords'),
      noRelatedWords: morphemeT('noRelatedWords'),
      separable: morphemeT('separable'),
    },
    wordPanel: {
      close: wordT('closePanel'),
      loading: t('loading'),
      loadError: t('loadError'),
      retry: t('retry'),
      plural: wordT.raw('plural') as string,
      playWord: wordT.raw('playWord') as string,
      meaning: wordT('meaning'),
      structure: wordT('structure'),
      examples: wordT('examples'),
      wordFamily: wordT('wordFamily'),
      noExamples: wordT('noExamples'),
      noRelatedWords: wordT('noRelatedWords'),
      playExample: wordT('playExample'),
      slowAudio: wordT('slowAudio'),
      morphemeTypes,
      partsOfSpeech,
    },
  }
}
