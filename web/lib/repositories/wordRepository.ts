import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { RepositoryError } from '@/lib/errors'
import { getAudioUrl } from '@/lib/utils/audioUrl'
import { findFamiliarities } from '@/lib/repositories/familiarityRepository'
import { encodeWordCursor, type WordCursor } from '@/lib/utils/cursor'
import { normalizePartOfSpeech, partOfSpeechPrefixes } from '@/lib/utils/partOfSpeech'
import type { WordListParams } from '@/lib/validation/words'
import type { Database } from '@/types/db'
import type {
  CursorPage,
  RelatedWord,
  WordDetail,
  WordDetailExample,
  WordExample,
  WordFilterOptions,
  WordListItem,
  WordSegment,
} from '@/types/domain'

interface WordListQuery extends WordListParams {
  decodedCursor?: WordCursor
}

interface ExampleRecord {
  id: number
  sentence: string
}

function assertQuerySucceeded(error: PostgrestError | null, operation: string): void {
  if (error) {
    throw new RepositoryError(`Failed to ${operation}`, { cause: error })
  }
}

function intersectIds(collections: number[][]): number[] | undefined {
  if (collections.length === 0) {
    return undefined
  }

  return collections
    .slice(1)
    .reduce(
      (intersection, ids) => intersection.filter((id) => ids.includes(id)),
      collections[0] ?? [],
    )
}

async function findTopicWordIds(db: SupabaseClient<Database>, topic: string): Promise<number[]> {
  const { data, error } = await db
    .from('word_tags')
    .select('word_id, tags!inner(slug, type)')
    .eq('tags.slug', topic)
    .eq('tags.type', 'topic')

  assertQuerySucceeded(error, 'filter words by topic')
  return (data ?? []).map(({ word_id }) => word_id)
}

async function findMorphemeWordIds(
  db: SupabaseClient<Database>,
  morpheme: string,
): Promise<number[]> {
  const { data, error } = await db
    .from('word_morphemes')
    .select('word_id, morphemes!inner(slug)')
    .eq('morphemes.slug', morpheme)

  assertQuerySucceeded(error, 'filter words by morpheme')
  return (data ?? []).map(({ word_id }) => word_id)
}

async function findFilterWordIds(
  db: SupabaseClient<Database>,
  params: WordListQuery,
): Promise<number[] | undefined> {
  const lookups: Array<Promise<number[]>> = []

  if (params.topic) {
    lookups.push(findTopicWordIds(db, params.topic))
  }

  if (params.morpheme) {
    lookups.push(findMorphemeWordIds(db, params.morpheme))
  }

  return intersectIds(await Promise.all(lookups))
}

function getCursorFilter(cursor: WordCursor): string {
  if (cursor.freqRank === null) {
    return `and(freq_rank.is.null,id.gt.${cursor.id})`
  }

  return [
    `freq_rank.gt.${cursor.freqRank}`,
    `and(freq_rank.eq.${cursor.freqRank},id.gt.${cursor.id})`,
    'freq_rank.is.null',
  ].join(',')
}

async function findExamples(
  db: SupabaseClient<Database>,
  wordIds: number[],
  explainLanguage: string,
): Promise<Map<number, WordExample>> {
  const { data: linkRows, error: linkError } = await db
    .from('example_links')
    .select('target_id, example_id, sort_order')
    .eq('target_type', 'word')
    .in('target_id', wordIds)
    .order('sort_order', { ascending: true })
    .order('example_id', { ascending: true })

  assertQuerySucceeded(linkError, 'load word examples')

  const firstExampleIdByWord = new Map<number, number>()
  for (const link of linkRows ?? []) {
    if (!firstExampleIdByWord.has(link.target_id)) {
      firstExampleIdByWord.set(link.target_id, link.example_id)
    }
  }

  const exampleIds = [...new Set(firstExampleIdByWord.values())]
  if (exampleIds.length === 0) {
    return new Map()
  }

  const [examplesResult, translationsResult, audioResult] = await Promise.all([
    db.from('examples').select('id, sentence:example_sentence').in('id', exampleIds),
    db
      .from('example_translations')
      .select('example_id, text:sentence_meaning')
      .in('example_id', exampleIds)
      .eq('meaning_language', explainLanguage),
    db
      .from('audio')
      .select('owner_id, path, id')
      .eq('owner_type', 'example')
      .in('owner_id', exampleIds)
      .order('id', { ascending: true }),
  ])

  assertQuerySucceeded(examplesResult.error, 'load examples')
  assertQuerySucceeded(translationsResult.error, 'load example translations')
  assertQuerySucceeded(audioResult.error, 'load example audio')

  const examplesById = new Map<number, ExampleRecord>(
    (examplesResult.data ?? []).map((example) => [example.id, example]),
  )
  const translationsByExampleId = new Map(
    (translationsResult.data ?? []).map((translation) => [
      translation.example_id,
      translation.text,
    ]),
  )
  const audioByExampleId = new Map<number, string>()
  for (const audio of audioResult.data ?? []) {
    if (!audioByExampleId.has(audio.owner_id)) {
      audioByExampleId.set(audio.owner_id, audio.path)
    }
  }

  const result = new Map<number, WordExample>()
  for (const [wordId, exampleId] of firstExampleIdByWord) {
    const example = examplesById.get(exampleId)
    const translation = translationsByExampleId.get(exampleId)

    if (example && translation) {
      result.set(wordId, {
        sentence: example.sentence,
        translation,
        audioUrl: getAudioUrl(audioByExampleId.get(exampleId)),
      })
    }
  }

  return result
}

async function findWordAudio(
  db: SupabaseClient<Database>,
  wordIds: number[],
): Promise<Map<number, string>> {
  const { data, error } = await db
    .from('audio')
    .select('owner_id, path, id')
    .eq('owner_type', 'word')
    .in('owner_id', wordIds)
    .order('id', { ascending: true })

  assertQuerySucceeded(error, 'load word audio')

  const result = new Map<number, string>()
  for (const audio of data ?? []) {
    if (!result.has(audio.owner_id)) {
      result.set(audio.owner_id, audio.path)
    }
  }

  return result
}

async function findFavoriteWordIds(
  db: SupabaseClient<Database>,
  wordIds: number[],
  userId?: string,
): Promise<Set<number>> {
  if (!userId) {
    return new Set()
  }

  const { data, error } = await db
    .from('user_word_state')
    .select('word_id')
    .eq('user_id', userId)
    .eq('favorited', true)
    .in('word_id', wordIds)

  assertQuerySucceeded(error, 'load favorites')
  return new Set((data ?? []).map(({ word_id }) => word_id))
}

interface WordIdFilter {
  include?: number[]
  exclude?: number[]
}

function queryWordRows(
  db: SupabaseClient<Database>,
  params: WordListQuery,
  limit: number,
  idFilter: WordIdFilter,
  cursor?: WordCursor,
) {
  let query = db
    .from('words')
    .select(
      'id, slug, lemma:word, pos:word_class, posDetail:word_class_detail, gender, level, freq_rank, word_morphemes(position, surface:word_part, morpheme_id, morphemes(type:morpheme_type)), senses(gloss:word_meaning, gloss_language:meaning_language, sort_order)',
    )
    .eq('language', params.lang)
    .order('freq_rank', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(limit)

  if (params.level) {
    query = query.eq('level', params.level)
  }

  if (params.q) {
    query = query.ilike('word', `%${params.q}%`)
  }

  if (params.pos) {
    const prefixes = partOfSpeechPrefixes[normalizePartOfSpeech(params.pos)]
    if (!prefixes) {
      query = query.eq('word_class', params.pos)
    } else if (prefixes.length === 1) {
      query = query.ilike('word_class', `${prefixes[0]}%`)
    } else {
      query = query.or(prefixes.map((prefix) => `word_class.ilike.${prefix}%`).join(','))
    }
  }

  if (idFilter.include) {
    query = query.in('id', idFilter.include)
  }

  if (idFilter.exclude && idFilter.exclude.length > 0) {
    query = query.not('id', 'in', `(${idFilter.exclude.join(',')})`)
  }

  if (cursor) {
    query = query.or(getCursorFilter(cursor))
  }

  return query
}

type WordListRecord = NonNullable<Awaited<ReturnType<typeof queryWordRows>>['data']>[number]

// Familiarity lives in user_word_state, which PostgREST cannot sort words by, so each familiarity
// group is read in turn (keeping the usual frequency order inside a group) until the page is full.
async function findWordRowsByFamiliarity(
  db: SupabaseClient<Database>,
  params: WordListQuery,
  filterWordIds: number[] | undefined,
  familiarityByWordId: Map<number, number>,
): Promise<WordListRecord[]> {
  const levels = params.sort === 'familiarity_desc' ? [5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5]
  const cursor = params.decodedCursor
  const ratedIds = [...familiarityByWordId.keys()]
  const filterIdSet = filterWordIds ? new Set(filterWordIds) : null
  const rows: WordListRecord[] = []

  for (const level of levels.slice(cursor ? levels.indexOf(cursor.familiarity ?? 0) : 0)) {
    const remaining = params.limit + 1 - rows.length
    if (remaining <= 0) {
      break
    }

    let idFilter: WordIdFilter
    if (level > 0) {
      const levelIds = ratedIds.filter((id) => familiarityByWordId.get(id) === level)
      idFilter = { include: filterIdSet ? levelIds.filter((id) => filterIdSet.has(id)) : levelIds }
    } else if (filterWordIds) {
      idFilter = { include: filterWordIds.filter((id) => !familiarityByWordId.has(id)) }
    } else {
      idFilter = { exclude: ratedIds }
    }

    if (idFilter.include?.length === 0) {
      continue
    }

    const { data, error } = await queryWordRows(
      db,
      params,
      remaining,
      idFilter,
      cursor?.familiarity === level ? cursor : undefined,
    )
    assertQuerySucceeded(error, 'list words by familiarity')
    rows.push(...(data ?? []))
  }

  return rows
}

export async function findWords(
  db: SupabaseClient<Database>,
  params: WordListQuery,
  userId?: string,
): Promise<CursorPage<WordListItem>> {
  const filterWordIds = await findFilterWordIds(db, params)
  if (filterWordIds?.length === 0) {
    return { items: [], nextCursor: null }
  }

  const familiarityByWordId = params.sort
    ? new Map(
        (userId ? await findFamiliarities(db, userId) : []).map(({ wordId, level }) => [
          wordId,
          level,
        ]),
      )
    : null
  let rows: WordListRecord[]

  if (familiarityByWordId) {
    rows = await findWordRowsByFamiliarity(db, params, filterWordIds, familiarityByWordId)
  } else {
    const { data, error } = await queryWordRows(
      db,
      params,
      params.limit + 1,
      { include: filterWordIds },
      params.decodedCursor,
    )
    assertQuerySucceeded(error, 'list words')
    rows = data ?? []
  }

  const hasNextPage = rows.length > params.limit
  const pageRows = hasNextPage ? rows.slice(0, params.limit) : rows
  const wordIds = pageRows.map(({ id }) => id)

  if (wordIds.length === 0) {
    return { items: [], nextCursor: null }
  }

  const [examplesByWordId, audioByWordId, favoriteWordIds] = await Promise.all([
    findExamples(db, wordIds, params.explain),
    findWordAudio(db, wordIds),
    findFavoriteWordIds(db, wordIds, userId),
  ])

  const items = pageRows.map<WordListItem>((word) => {
    const segments: WordSegment[] = word.word_morphemes
      .toSorted((left, right) => left.position - right.position)
      .map((segment) => ({
        surface: segment.surface,
        morphemeId: segment.morpheme_id,
        type: segment.morphemes?.type ?? null,
      }))
    const glosses = word.senses
      .filter(({ gloss_language }) => gloss_language === params.explain)
      .toSorted((left, right) => left.sort_order - right.sort_order)
      .map(({ gloss }) => gloss)

    return {
      id: word.id,
      slug: word.slug,
      lemma: word.lemma,
      pos: word.pos,
      posDetail: word.posDetail,
      gender: word.gender,
      level: word.level,
      segments,
      glosses,
      example: examplesByWordId.get(word.id) ?? null,
      audioUrl: getAudioUrl(audioByWordId.get(word.id)),
      favorited: favoriteWordIds.has(word.id),
    }
  })

  const lastWord = pageRows.at(-1)
  const nextCursor =
    hasNextPage && lastWord
      ? encodeWordCursor({
          freqRank: lastWord.freq_rank,
          id: lastWord.id,
          ...(familiarityByWordId
            ? { familiarity: familiarityByWordId.get(lastWord.id) ?? 0 }
            : {}),
        })
      : null

  return { items, nextCursor }
}

export async function findWordFilterOptions(
  db: SupabaseClient<Database>,
  language: string,
): Promise<WordFilterOptions> {
  const [wordClassesResult, topicsResult] = await Promise.all([
    // Distinct values come from the database; selecting every word would stop at the row limit.
    db.rpc('word_class_options', { p_language: language }),
    db
      .from('word_tags')
      .select('tags!inner(slug, name, type), words!inner(language)')
      .eq('tags.type', 'topic')
      .eq('words.language', language),
  ])

  assertQuerySucceeded(wordClassesResult.error, 'load parts of speech')
  assertQuerySucceeded(topicsResult.error, 'load topic filters')

  const topicsBySlug = new Map<string, string>()
  for (const row of topicsResult.data ?? []) {
    topicsBySlug.set(row.tags.slug, row.tags.name)
  }

  return {
    partsOfSpeech: [
      ...new Set((wordClassesResult.data ?? []).map((pos) => normalizePartOfSpeech(pos))),
    ].toSorted(),
    topics: [...topicsBySlug.entries()]
      .map(([value, label]) => ({ value, label }))
      .toSorted((left, right) => left.label.localeCompare(right.label)),
  }
}

export type WordDetailLookupResult =
  { kind: 'found'; word: WordDetail } | { kind: 'redirect'; slug: string } | { kind: 'notFound' }

async function findCanonicalSlug(
  db: SupabaseClient<Database>,
  language: string,
  oldSlug: string,
): Promise<string | null> {
  const { data: redirect, error: redirectError } = await db
    .from('word_slug_redirects')
    .select('word_id')
    .eq('language', language)
    .eq('old_slug', oldSlug)
    .maybeSingle()

  assertQuerySucceeded(redirectError, 'resolve word redirect')
  if (!redirect) {
    return null
  }

  const { data: word, error: wordError } = await db
    .from('words')
    .select('slug')
    .eq('id', redirect.word_id)
    .eq('language', language)
    .maybeSingle()

  assertQuerySucceeded(wordError, 'load redirected word')
  return word?.slug ?? null
}

async function findWordDetailExamples(
  db: SupabaseClient<Database>,
  wordId: number,
  explainLanguage: string,
): Promise<WordDetailExample[]> {
  const { data: links, error: linksError } = await db
    .from('example_links')
    .select('example_id, sort_order')
    .eq('target_type', 'word')
    .eq('target_id', wordId)
    .order('sort_order', { ascending: true })
    .order('example_id', { ascending: true })

  assertQuerySucceeded(linksError, 'load word example links')
  const exampleIds = (links ?? []).map(({ example_id }) => example_id)
  if (exampleIds.length === 0) {
    return []
  }

  const [examplesResult, translationsResult, audioResult] = await Promise.all([
    db.from('examples').select('id, sentence:example_sentence, level').in('id', exampleIds),
    db
      .from('example_translations')
      .select('example_id, text:sentence_meaning')
      .in('example_id', exampleIds)
      .eq('meaning_language', explainLanguage),
    db
      .from('audio')
      .select('owner_id, path, id')
      .eq('owner_type', 'example')
      .in('owner_id', exampleIds)
      .order('id', { ascending: true }),
  ])

  assertQuerySucceeded(examplesResult.error, 'load word detail examples')
  assertQuerySucceeded(translationsResult.error, 'load word detail example translations')
  assertQuerySucceeded(audioResult.error, 'load word detail example audio')

  const examplesById = new Map((examplesResult.data ?? []).map((example) => [example.id, example]))
  const translationsById = new Map(
    (translationsResult.data ?? []).map((translation) => [
      translation.example_id,
      translation.text,
    ]),
  )
  const audioById = new Map<number, string>()
  for (const audio of audioResult.data ?? []) {
    if (!audioById.has(audio.owner_id)) {
      audioById.set(audio.owner_id, audio.path)
    }
  }

  return exampleIds.flatMap<WordDetailExample>((exampleId) => {
    const example = examplesById.get(exampleId)
    const translation = translationsById.get(exampleId)

    return example && translation
      ? [
          {
            id: example.id,
            sentence: example.sentence,
            translation,
            level: example.level,
            audioUrl: getAudioUrl(audioById.get(example.id)),
          },
        ]
      : []
  })
}

async function findRelatedWords(
  db: SupabaseClient<Database>,
  wordId: number,
  rootMorphemeIds: number[],
  language: string,
): Promise<RelatedWord[]> {
  if (rootMorphemeIds.length === 0) {
    return []
  }

  const { data: relations, error: relationsError } = await db
    .from('word_morphemes')
    .select('word_id, morpheme_id')
    .in('morpheme_id', rootMorphemeIds)
    .neq('word_id', wordId)

  assertQuerySucceeded(relationsError, 'load related word relationships')

  const sharedMorphemesByWordId = new Map<number, Set<number>>()
  for (const relation of relations ?? []) {
    if (relation.morpheme_id === null) {
      continue
    }

    const sharedIds = sharedMorphemesByWordId.get(relation.word_id) ?? new Set<number>()
    sharedIds.add(relation.morpheme_id)
    sharedMorphemesByWordId.set(relation.word_id, sharedIds)
  }

  const relatedWordIds = [...sharedMorphemesByWordId.keys()]
  if (relatedWordIds.length === 0) {
    return []
  }

  const { data: words, error: wordsError } = await db
    .from('words')
    .select('id, slug, lemma:word, pos:word_class, posDetail:word_class_detail, gender, level')
    .eq('language', language)
    .in('id', relatedWordIds)
    .order('freq_rank', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(8)

  assertQuerySucceeded(wordsError, 'load related words')

  return (words ?? []).map((word) => ({
    id: word.id,
    slug: word.slug,
    lemma: word.lemma,
    pos: word.pos,
    posDetail: word.posDetail,
    gender: word.gender,
    level: word.level,
    sharedMorphemeIds: [...(sharedMorphemesByWordId.get(word.id) ?? [])],
  }))
}

export async function findWordBySlug(
  db: SupabaseClient<Database>,
  language: string,
  slug: string,
  explainLanguage: string,
  userId?: string,
): Promise<WordDetailLookupResult> {
  const { data: word, error } = await db
    .from('words')
    .select(
      'id, slug, lemma:word, pos:word_class, posDetail:word_class_detail, gender, plural, level, word_morphemes(position, surface:word_part, morpheme_id, morphemes(id, slug, text:morpheme, type:morpheme_type, meaning:morpheme_meaning, separable:is_separable)), senses(gloss:word_meaning, gloss_language:meaning_language, sort_order)',
    )
    .eq('language', language)
    .eq('slug', slug)
    .maybeSingle()

  assertQuerySucceeded(error, 'load word detail')

  if (!word) {
    const canonicalSlug = await findCanonicalSlug(db, language, slug)
    return canonicalSlug ? { kind: 'redirect', slug: canonicalSlug } : { kind: 'notFound' }
  }

  const rootMorphemeIds = word.word_morphemes.flatMap((segment) =>
    segment.morpheme_id !== null && segment.morphemes?.type === 'root' ? [segment.morpheme_id] : [],
  )
  const [examples, audioByWordId, favoriteWordIds, relatedWords] = await Promise.all([
    findWordDetailExamples(db, word.id, explainLanguage),
    findWordAudio(db, [word.id]),
    findFavoriteWordIds(db, [word.id], userId),
    findRelatedWords(db, word.id, rootMorphemeIds, language),
  ])

  return {
    kind: 'found',
    word: {
      id: word.id,
      slug: word.slug,
      lemma: word.lemma,
      pos: word.pos,
      posDetail: word.posDetail,
      gender: word.gender,
      plural: word.plural,
      level: word.level,
      glosses: word.senses
        .filter(({ gloss_language }) => gloss_language === explainLanguage)
        .toSorted((left, right) => left.sort_order - right.sort_order)
        .map(({ gloss }) => gloss),
      segments: word.word_morphemes
        .toSorted((left, right) => left.position - right.position)
        .map((segment) => ({
          surface: segment.surface,
          morpheme: segment.morphemes
            ? {
                id: segment.morphemes.id,
                slug: segment.morphemes.slug,
                text: segment.morphemes.text,
                type: segment.morphemes.type,
                meaning: segment.morphemes.meaning,
                separable: segment.morphemes.separable,
              }
            : null,
        })),
      examples,
      relatedWords,
      audioUrl: getAudioUrl(audioByWordId.get(word.id)),
      favorited: favoriteWordIds.has(word.id),
    },
  }
}
