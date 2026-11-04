import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { RepositoryError } from '@/lib/errors'
import { getAudioUrl } from '@/lib/utils/audioUrl'
import { encodeWordCursor, type WordCursor } from '@/lib/utils/cursor'
import { normalizePartOfSpeech, partOfSpeechPrefixes } from '@/lib/utils/partOfSpeech'
import type { WordIdsParams, WordListParams } from '@/lib/validation/words'
import type { WordSort } from '@/lib/constants'
import type { Database } from '@/types/db'
import type {
  CursorPage,
  ExampleToken,
  RelatedWord,
  WordDetail,
  WordDetailExample,
  WordExample,
  WordFilterCounts,
  WordFilterOptions,
  WordListItem,
  WordSegment,
} from '@/types/domain'

type KeysetCursor = Extract<WordCursor, { id: number }>

interface WordListQuery extends Omit<WordListParams, 'sort' | 'order'> {
  decodedCursor?: WordCursor
  // Any order but the default, most common first; that one pages through queryWordRows instead.
  ordering?: { sort: WordSort; descending: boolean }
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

async function findAllFavoriteWordIds(
  db: SupabaseClient<Database>,
  userId: string | undefined,
): Promise<number[]> {
  if (!userId) {
    return []
  }

  const { data, error } = await db
    .from('user_word_state')
    .select('word_id')
    .eq('user_id', userId)
    .eq('favorited', true)

  assertQuerySucceeded(error, 'filter words by favorites')
  return (data ?? []).map(({ word_id }) => word_id)
}

async function findFilterWordIds(
  db: SupabaseClient<Database>,
  params: Pick<WordListQuery, 'favorites' | 'morpheme'>,
  userId?: string,
): Promise<number[] | undefined> {
  const lookups: Array<Promise<number[]>> = []

  if (params.favorites) {
    lookups.push(findAllFavoriteWordIds(db, userId))
  }

  if (params.morpheme) {
    lookups.push(findMorphemeWordIds(db, params.morpheme))
  }

  return intersectIds(await Promise.all(lookups))
}

function getCursorFilter(cursor: KeysetCursor): string {
  if (cursor.freqRank === null) {
    return `and(freq_rank.is.null,id.gt.${cursor.id})`
  }

  return [
    `freq_rank.gt.${cursor.freqRank}`,
    `and(freq_rank.eq.${cursor.freqRank},id.gt.${cursor.id})`,
    'freq_rank.is.null',
  ].join(',')
}

async function findExampleTokens(
  db: SupabaseClient<Database>,
  exampleIds: number[],
  explainLanguage: string,
): Promise<Map<number, ExampleToken[]>> {
  const { data, error } = await db
    .from('example_tokens')
    .select(
      'example_id, position, start_offset, end_offset, lemma, word_id, words(slug), example_token_glosses(gloss)',
    )
    .in('example_id', exampleIds)
    .eq('example_token_glosses.meaning_language', explainLanguage)
    .order('example_id', { ascending: true })
    .order('position', { ascending: true })

  assertQuerySucceeded(error, 'load example tokens')

  const result = new Map<number, ExampleToken[]>()
  for (const token of data ?? []) {
    const tokens = result.get(token.example_id) ?? []
    tokens.push({
      start: token.start_offset,
      end: token.end_offset,
      lemma: token.lemma,
      gloss: token.example_token_glosses[0]?.gloss ?? null,
      wordId: token.word_id,
      wordSlug: token.words?.slug ?? null,
    })
    result.set(token.example_id, tokens)
  }
  return result
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

  const [examplesResult, translationsResult, audioResult, tokensByExampleId] = await Promise.all([
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
    findExampleTokens(db, exampleIds, explainLanguage),
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
        tokens: tokensByExampleId.get(exampleId) ?? [],
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
}

// ilike patterns matching the stored word classes a part-of-speech filter stands for.
function getWordClassPatterns(pos: string): string[] {
  const prefixes = partOfSpeechPrefixes[normalizePartOfSpeech(pos)]
  return prefixes ? prefixes.map((prefix) => `${prefix}%`) : [pos]
}

function queryWordRows(
  db: SupabaseClient<Database>,
  params: WordListQuery,
  limit: number,
  idFilter: WordIdFilter,
  cursor?: KeysetCursor,
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
    query = query.or(
      getWordClassPatterns(params.pos)
        .map((pattern) => `word_class.ilike.${pattern}`)
        .join(','),
    )
  }

  if (idFilter.include) {
    query = query.in('id', idFilter.include)
  }

  if (cursor) {
    query = query.or(getCursorFilter(cursor))
  }

  return query
}

type WordListRecord = NonNullable<Awaited<ReturnType<typeof queryWordRows>>['data']>[number]

async function toWordListItems(
  db: SupabaseClient<Database>,
  rows: WordListRecord[],
  explainLanguage: string,
  userId?: string,
): Promise<WordListItem[]> {
  const wordIds = rows.map(({ id }) => id)
  const [examplesByWordId, audioByWordId, favoriteWordIds] = await Promise.all([
    findExamples(db, wordIds, explainLanguage),
    findWordAudio(db, wordIds),
    findFavoriteWordIds(db, wordIds, userId),
  ])

  return rows.map<WordListItem>((word) => {
    const segments: WordSegment[] = word.word_morphemes
      .toSorted((left, right) => left.position - right.position)
      .map((segment) => ({
        surface: segment.surface,
        morphemeId: segment.morpheme_id,
        type: segment.morphemes?.type ?? null,
      }))
    const glosses = word.senses
      .filter(({ gloss_language }) => gloss_language === explainLanguage)
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
}

// Returns the words in the order of wordIds, skipping any that are not found.
export async function findWordsByIds(
  db: SupabaseClient<Database>,
  language: string,
  explainLanguage: string,
  wordIds: number[],
  userId?: string,
): Promise<WordListItem[]> {
  if (wordIds.length === 0) {
    return []
  }

  const { data, error } = await queryWordRows(
    db,
    { lang: language, explain: explainLanguage, limit: wordIds.length },
    wordIds.length,
    { include: wordIds },
  )
  assertQuerySucceeded(error, 'load words by id')

  const items = await toWordListItems(db, data ?? [], explainLanguage, userId)
  const itemsById = new Map(items.map((item) => [item.id, item]))
  return wordIds.flatMap((id) => itemsById.get(id) ?? [])
}

async function findSortedWordIds(
  db: SupabaseClient<Database>,
  params: WordListQuery & Required<Pick<WordListQuery, 'ordering'>>,
  filterWordIds: number[] | undefined,
  offset: number,
): Promise<number[]> {
  const { data, error } = await db.rpc('list_word_ids', {
    p_language: params.lang,
    p_sort: params.ordering.sort,
    p_descending: params.ordering.descending,
    p_level: params.level,
    p_query: params.q,
    p_word_class_patterns: params.pos ? getWordClassPatterns(params.pos) : undefined,
    p_word_ids: filterWordIds,
    p_topic: params.topic,
    p_offset: offset,
    p_limit: params.limit + 1,
  })
  assertQuerySucceeded(error, 'sort words')
  return data ?? []
}

// Every word the list's filters match, in no particular order.
export async function findAllWordIds(
  db: SupabaseClient<Database>,
  params: WordIdsParams,
  userId?: string,
): Promise<number[]> {
  const filterWordIds = await findFilterWordIds(db, params, userId)
  if (filterWordIds?.length === 0) {
    return []
  }

  const { data, error } = await db.rpc('list_all_word_ids', {
    p_language: params.lang,
    p_level: params.level,
    p_query: params.q,
    p_word_class_patterns: params.pos ? getWordClassPatterns(params.pos) : undefined,
    p_word_ids: filterWordIds,
    p_topic: params.topic,
    p_marked: params.marked,
  })
  assertQuerySucceeded(error, 'list word ids')
  return data ?? []
}

export async function findWords(
  db: SupabaseClient<Database>,
  params: WordListQuery,
  userId?: string,
): Promise<CursorPage<WordListItem>> {
  const filterWordIds = await findFilterWordIds(db, params, userId)
  if (filterWordIds?.length === 0) {
    return { items: [], nextCursor: null }
  }

  const cursor = params.decodedCursor
  if (params.ordering) {
    const offset = cursor && 'offset' in cursor ? cursor.offset : 0
    const ids = await findSortedWordIds(
      db,
      { ...params, ordering: params.ordering },
      filterWordIds,
      offset,
    )
    const hasNextPage = ids.length > params.limit
    const items = await findWordsByIds(
      db,
      params.lang,
      params.explain,
      ids.slice(0, params.limit),
      userId,
    )
    return {
      items,
      nextCursor: hasNextPage ? encodeWordCursor({ offset: offset + params.limit }) : null,
    }
  }

  const { data, error } = await queryWordRows(
    db,
    params,
    params.limit + 1,
    { include: filterWordIds },
    cursor && 'id' in cursor ? cursor : undefined,
  )
  assertQuerySucceeded(error, 'list words')
  const rows = data ?? []

  const hasNextPage = rows.length > params.limit
  const pageRows = hasNextPage ? rows.slice(0, params.limit) : rows

  if (pageRows.length === 0) {
    return { items: [], nextCursor: null }
  }

  const items = await toWordListItems(db, pageRows, params.explain, userId)

  const lastWord = pageRows.at(-1)
  const nextCursor =
    hasNextPage && lastWord
      ? encodeWordCursor({ freqRank: lastWord.freq_rank, id: lastWord.id })
      : null

  return { items, nextCursor }
}

// The words a list page shows before any filter is chosen.
export type WordFilterScope = Pick<WordListParams, 'level' | 'morpheme' | 'favorites'>

export async function findWordFilterOptions(
  db: SupabaseClient<Database>,
  language: string,
  scope: WordFilterScope,
  userId?: string,
): Promise<WordFilterOptions> {
  const [wordClassesResult, topicsResult, counts] = await Promise.all([
    // Distinct values and counts come from the database; selecting every row would stop at the
    // API row limit (1000).
    db.rpc('word_class_options', { p_language: language }),
    db.rpc('topic_counts', { p_language: language }),
    findWordFilterCounts(db, language, scope, userId),
  ])

  assertQuerySucceeded(wordClassesResult.error, 'load parts of speech')
  assertQuerySucceeded(topicsResult.error, 'load topic filters')

  return {
    partsOfSpeech: [
      ...new Set((wordClassesResult.data ?? []).map((pos) => normalizePartOfSpeech(pos))),
    ].toSorted(),
    topics: (topicsResult.data ?? [])
      .filter((topic) => topic.word_count > 0)
      .map((topic) => ({ value: topic.slug, label: topic.name }))
      .toSorted((left, right) => left.label.localeCompare(right.label)),
    counts,
  }
}

async function findWordFilterCounts(
  db: SupabaseClient<Database>,
  language: string,
  scope: WordFilterScope,
  userId?: string,
): Promise<WordFilterCounts> {
  const counts: WordFilterCounts = {
    levels: {},
    partsOfSpeech: {},
    topics: {},
    allLevels: 0,
    total: 0,
  }
  const filterWordIds = await findFilterWordIds(db, scope, userId)
  if (filterWordIds?.length === 0) {
    return counts
  }

  const { data, error } = await db.rpc('word_filter_counts', {
    p_language: language,
    p_level: scope.level,
    p_word_ids: filterWordIds,
  })
  assertQuerySucceeded(error, 'count words per filter')

  for (const { facet, value, word_count: count } of data ?? []) {
    if (facet === 'level') {
      // Words without a level only count towards all levels.
      if (value) counts.levels[value] = count
      counts.allLevels += count
    } else if (facet === 'word_class') {
      // Several word classes in the data, such as "Nomen" and "noun", are one part of speech.
      const partOfSpeech = normalizePartOfSpeech(value)
      counts.partsOfSpeech[partOfSpeech] = (counts.partsOfSpeech[partOfSpeech] ?? 0) + count
      counts.total += count
    } else if (facet === 'topic') {
      counts.topics[value] = count
    }
  }

  return counts
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

  const [examplesResult, translationsResult, audioResult, tokensByExampleId] = await Promise.all([
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
    findExampleTokens(db, exampleIds, explainLanguage),
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
            tokens: tokensByExampleId.get(example.id) ?? [],
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
  explainLanguage: string,
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
    .select(
      'id, slug, lemma:word, pos:word_class, posDetail:word_class_detail, gender, level, senses(gloss:word_meaning, gloss_language:meaning_language, sort_order)',
    )
    .eq('language', language)
    .in('id', relatedWordIds)
    .order('freq_rank', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(8)

  assertQuerySucceeded(wordsError, 'load related words')

  const examplesByWordId =
    words && words.length > 0
      ? await findExamples(
          db,
          words.map(({ id }) => id),
          explainLanguage,
        )
      : new Map<number, WordExample>()

  return (words ?? []).map((word) => ({
    id: word.id,
    slug: word.slug,
    lemma: word.lemma,
    pos: word.pos,
    posDetail: word.posDetail,
    gender: word.gender,
    level: word.level,
    sharedMorphemeIds: [...(sharedMorphemesByWordId.get(word.id) ?? [])],
    glosses: word.senses
      .filter(({ gloss_language }) => gloss_language === explainLanguage)
      .toSorted((left, right) => left.sort_order - right.sort_order)
      .map(({ gloss }) => gloss),
    example: examplesByWordId.get(word.id) ?? null,
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
    findRelatedWords(db, word.id, rootMorphemeIds, language, explainLanguage),
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
