import { notFound, permanentRedirect } from 'next/navigation'

import { NotFoundError, UnsupportedLanguageError } from '@/lib/errors'
import { getWordDetail } from '@/lib/services/wordService'
import { getPublicSupabase } from '@/lib/supabase/server'
import { getWordPanelPath } from '@/lib/wordPanel'

interface WordPageProps {
  params: Promise<{
    lang: string
    slug: string
  }>
}

// Words no longer have a page of their own: they open in the side panel of their level's list.
// This keeps old links and search results working, renamed slugs included.
export default async function WordPage({ params }: WordPageProps) {
  const { lang, slug } = await params

  let result
  try {
    result = await getWordDetail(getPublicSupabase(), slug, { lang, explain: 'en' })
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof UnsupportedLanguageError) {
      notFound()
    }
    throw error
  }

  if (result.kind === 'redirect') {
    permanentRedirect(`/${encodeURIComponent(lang)}/word/${encodeURIComponent(result.slug)}`)
  }

  permanentRedirect(getWordPanelPath(lang, result.word.slug, result.word.level))
}
