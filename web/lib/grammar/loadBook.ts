import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { cache } from 'react'

import type { GrammarTopic } from '@/lib/grammar/contents'
import type { GrammarDetail } from '@/lib/grammar/details'
import type { SupportedLanguageCode } from '@/lib/languages'

// The book's text is copyrighted, so it lives only in the git-ignored data folder beside the web
// app, and never in the repository: its table of contents in book.json and its text one file per
// chapter. Without the folder (in CI or on the deployed site) there is no grammar at all.
const grammarDataDirectory = path.join(process.cwd(), '..', 'data', 'grammar')

// The one book so far, read in the language it was written in, until there is a choice of both.
const book = 'grammar-1'
const explanationLanguage = 'zh'

export interface GrammarBook {
  contents: readonly GrammarTopic[]
  details: Record<string, GrammarDetail>
}

// Once per request, as the page and its metadata both need it.
export const loadGrammarBook = cache(async function loadGrammarBook(
  language: SupportedLanguageCode,
): Promise<GrammarBook | null> {
  const bookDirectory = path.join(grammarDataDirectory, language, book)
  let contents: readonly GrammarTopic[]
  try {
    const bookFile = JSON.parse(await readFile(path.join(bookDirectory, 'book.json'), 'utf8')) as {
      contents: readonly GrammarTopic[]
    }
    contents = bookFile.contents
  } catch {
    return null
  }

  const textDirectory = path.join(bookDirectory, explanationLanguage)
  let files: string[]
  try {
    files = (await readdir(textDirectory)).filter((file) => file.endsWith('.json'))
  } catch {
    files = []
  }
  const chapters = await Promise.all(
    files.map(
      async (file) =>
        JSON.parse(await readFile(path.join(textDirectory, file), 'utf8')) as {
          topics: GrammarDetail[]
        },
    ),
  )
  const details = Object.fromEntries(
    chapters.flatMap((chapter) => chapter.topics).map((detail) => [detail.number, detail]),
  )
  return { contents, details }
})
