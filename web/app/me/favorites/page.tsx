import type { Metadata } from 'next'

import { WordList } from '@/components/list/WordList'
import { supportedLanguageCodes } from '@/lib/languages'
import { listWordFilterOptions, listWords } from '@/lib/services/wordService'
import { getWordListLabels } from '@/lib/wordListLabels'

import { requireUser } from '../requireUser'

export const metadata: Metadata = {
  title: 'Favorites',
}

const PAGE_SIZE = 20

export default async function FavoritesPage() {
  const { supabase, user } = await requireUser('/me/favorites')
  // German is the only learning language so far; favorites follow the language switcher once
  // there are more.
  const [lang] = supportedLanguageCodes

  const [initialPage, filterOptions, labels] = await Promise.all([
    listWords(supabase, { lang, explain: 'en', favorites: true, limit: PAGE_SIZE }, user.id),
    listWordFilterOptions(supabase, lang),
    getWordListLabels(),
  ])

  return (
    <WordList
      favoritesOnly
      language={lang}
      initialPage={initialPage}
      filterOptions={filterOptions}
      labels={{ ...labels, empty: 'You have not saved any words yet.' }}
    />
  )
}
