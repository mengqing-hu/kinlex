import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any -- the generated types predate the video tables. */

import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { findWordSlugs } from '@/lib/repositories/wordRepository'
import { getPublicSupabase, getSupabase } from '@/lib/supabase/server'
import { type StudyVideo, type StudyVideoSummary, toFilteredKind } from '@/lib/videos/types'

// Until videos are stored in the database, the pages read the files kinlex-video writes:
// data/pipeline/<language>/videos/<id>.<meaning language>.json, with the video beside them as
// <id>.mp4. A deployment without them lists no videos.
const STUDY_ROOT = process.env.VIDEO_STUDY_DIR ?? path.join(process.cwd(), '..', 'data', 'pipeline')

const VIDEO_ID = /^[\w-]{11}$/
const FILE_NAME = /^([\w-]{11})\.([a-z]{2})\.json$/

const studyFileSchema = z.object({
  video_id: z.string(),
  title: z.string(),
  language: z.string(),
  meaning_language: z.string(),
  // Files written before the pipeline recorded it have none.
  duration_ms: z.number().nullish(),
  lines: z.array(
    z.object({
      position: z.number(),
      start_ms: z.number(),
      end_ms: z.number(),
      text: z.string(),
      translation: z.string().nullable(),
      tokens: z.array(
        z.object({
          start: z.number(),
          end: z.number(),
          surface: z.string(),
          lemma: z.string(),
          word_id: z.number().nullable(),
          gloss: z.string().nullable(),
          // Files written before words were timed have no times.
          start_ms: z.number().nullish(),
          end_ms: z.number().nullish(),
          filter_reason: z.string().nullish(),
        }),
      ),
    }),
  ),
})

type StudyFile = z.infer<typeof studyFileSchema>

export function videoDirectory(language: string): string {
  return path.join(STUDY_ROOT, language, 'videos')
}

// How long earlier processing took, stage by stage, one JSON record per line; kinlex-video adds to
// it as it finishes a video.
export function videoTimingsFile(): string {
  return path.join(STUDY_ROOT, 'video_timings.jsonl')
}

async function listFiles(language: string): Promise<{ id: string; meaningLanguage: string }[]> {
  try {
    const names = await readdir(videoDirectory(language))
    return names.flatMap((name) => {
      const match = FILE_NAME.exec(name)
      return match?.[1] && match[2] ? [{ id: match[1], meaningLanguage: match[2] }] : []
    })
  } catch {
    return []
  }
}

async function readStudyFile(
  language: string,
  id: string,
  meaningLanguage: string,
): Promise<StudyFile> {
  const text = await readFile(
    path.join(videoDirectory(language), `${id}.${meaningLanguage}.json`),
    'utf8',
  )
  return studyFileSchema.parse(JSON.parse(text))
}

// The downloaded video file and its size, or null when there is none.
export async function getVideoFile(
  language: string,
  id: string,
): Promise<{ path: string; size: number } | null> {
  if (!VIDEO_ID.test(id)) return null
  const file = path.join(videoDirectory(language), `${id}.mp4`)
  try {
    const info = await stat(file)
    return info.isFile() ? { path: file, size: info.size } : null
  } catch {
    return null
  }
}

// Gives every study file of the video the title; false when the video has none.
export async function renameStudyVideo(
  language: string,
  id: string,
  title: string,
): Promise<boolean> {
  const db = await videoDb()
  const { data, error } = await db
    .from('videos')
    .update({ title })
    .eq('id', id)
    .eq('language', language)
    .select('id')
  if (!missingTable(error)) {
    if (error) throw new Error(`rename video ${id}: ${error.message}`)
    return data.length > 0
  }
  const files = (await listFiles(language)).filter((file) => file.id === id)
  for (const { meaningLanguage } of files) {
    const file = path.join(videoDirectory(language), `${id}.${meaningLanguage}.json`)
    const data = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>
    await writeFile(file, JSON.stringify({ ...data, title }, null, 1), 'utf8')
  }
  return files.length > 0
}

// Archives the video (see below), or on an installation without the video tables removes its
// files; false when there was nothing to remove.
export async function deleteStudyVideo(language: string, id: string): Promise<boolean> {
  if (!VIDEO_ID.test(id)) return false
  // Deleting a video archives it: only the downloaded video goes, while its captions, examples,
  // original sound and words stay, and adding the video again downloads it anew.
  const db = await videoDb()
  const { data, error } = await db
    .from('videos')
    .update({ status: 'archived', media_path: null })
    .eq('id', id)
    .eq('language', language)
    .select('id')
  if (!missingTable(error)) {
    if (error) throw new Error(`archive video ${id}: ${error.message}`)
    if (data.length === 0) return false
    await rm(path.join(videoDirectory(language), `${id}.mp4`), { force: true })
    return true
  }
  const directory = videoDirectory(language)
  const names = (await readdir(directory).catch(() => [])).filter((name) =>
    name.startsWith(`${id}.`),
  )
  await Promise.all(names.map((name) => rm(path.join(directory, name), { force: true })))
  return names.length > 0
}

// The processed videos of a language, by title.
export async function listStudyVideos(language: string): Promise<StudyVideoSummary[]> {
  // The database is the source of truth once the video tables exist; the study files are only
  // read on an installation the migration has not reached.
  const fromDatabase = await listDatabaseVideos(language)
  if (fromDatabase) return fromDatabase
  const byId = new Map<string, string[]>()
  for (const file of await listFiles(language)) {
    byId.set(file.id, [...(byId.get(file.id) ?? []), file.meaningLanguage])
  }
  const videos = await Promise.all(
    [...byId].map(async ([id, meaningLanguages]) => {
      const meaningLanguage = meaningLanguages[0] ?? 'en'
      const [{ title, duration_ms: durationMs }, info] = await Promise.all([
        readStudyFile(language, id, meaningLanguage),
        // The study file is written when processing ends, which is when the video was added.
        stat(path.join(videoDirectory(language), `${id}.${meaningLanguage}.json`)),
      ])
      return {
        id,
        title,
        meaningLanguages,
        addedAt: info.mtime.toISOString(),
        durationMs: durationMs ?? null,
      }
    }),
  )
  return videos.toSorted((left, right) => left.title.localeCompare(right.title))
}

// A processed video explained in the meaning language when it was processed for it, else in
// English, else in whichever language it was processed for.
export async function getStudyVideo(
  language: string,
  id: string,
  meaningLanguage: string,
): Promise<StudyVideo | null> {
  const fromDatabase = await getDatabaseVideo(language, id, meaningLanguage)
  if (fromDatabase !== undefined) return fromDatabase
  const available = (await listFiles(language))
    .filter((file) => file.id === id)
    .map((file) => file.meaningLanguage)
  const chosen = [meaningLanguage, 'en', ...available].find((code) => available.includes(code))
  if (!chosen) return null

  const file = await readStudyFile(language, id, chosen)
  const wordIds = [
    ...new Set(file.lines.flatMap((line) => line.tokens.flatMap((token) => token.word_id ?? []))),
  ]
  const slugs = await findWordSlugs(getPublicSupabase(), wordIds)

  return {
    id: file.video_id,
    title: file.title,
    language: file.language,
    meaningLanguage: file.meaning_language,
    lines: file.lines.map((line) => ({
      position: line.position,
      startMs: line.start_ms,
      endMs: line.end_ms,
      text: line.text,
      translation: line.translation,
      tokens: line.tokens.map((token) => ({
        start: token.start,
        end: token.end,
        surface: token.surface,
        lemma: token.lemma,
        slug: token.word_id === null ? null : (slugs.get(token.word_id) ?? null),
        gloss: token.gloss,
        startMs: token.start_ms ?? null,
        endMs: token.end_ms ?? null,
        filtered: toFilteredKind(token.filter_reason),
      })),
    })),
  }
}

// The generated database types predate the video tables, so these reads go through an untyped
// client until the types are regenerated.
async function videoDb(): Promise<any> {
  return getSupabase()
}

export function missingTable(error: { code?: string } | null): boolean {
  // PostgREST answers PGRST205 for a table it does not know.
  return error?.code === 'PGRST205' || error?.code === '42P01'
}

// The learner's videos of a language that are not archived, or null when the tables do not exist.
async function listDatabaseVideos(language: string): Promise<StudyVideoSummary[] | null> {
  const db = await videoDb()
  const { data, error } = await db
    .from('videos')
    .select('id, title, created_at, duration_ms')
    .eq('language', language)
    .neq('status', 'archived')
    .order('title')
  if (missingTable(error)) return null
  if (error) throw new Error(`list videos: ${error.message}`)
  const videos = (data ?? []) as Array<{
    id: string
    title: string
    created_at: string
    duration_ms: number | null
  }>
  if (videos.length === 0) return []

  // Every meaning language translates the first line, so its translations name the languages.
  const { data: translations, error: translationsError } = await db
    .from('video_line_translations')
    .select('video_id, meaning_language')
    .in(
      'video_id',
      videos.map((video) => video.id),
    )
    .eq('position', 0)
  if (translationsError) throw new Error(`list videos: ${translationsError.message}`)
  const languages = new Map<string, string[]>()
  for (const row of (translations ?? []) as Array<{ video_id: string; meaning_language: string }>) {
    languages.set(row.video_id, [...(languages.get(row.video_id) ?? []), row.meaning_language])
  }
  return videos.map((video) => ({
    id: video.id,
    title: video.title,
    meaningLanguages: languages.get(video.id) ?? [],
    addedAt: video.created_at,
    durationMs: video.duration_ms,
  }))
}

// The video explained in meaningLanguage when it has that, else English, else any language it has;
// null when the learner has no such video, undefined when the tables do not exist.
async function getDatabaseVideo(
  language: string,
  id: string,
  meaningLanguage: string,
): Promise<StudyVideo | null | undefined> {
  const db = await videoDb()
  const { data: video, error } = await db
    .from('videos')
    .select('id, title, language')
    .eq('id', id)
    .eq('language', language)
    .maybeSingle()
  if (missingTable(error)) return undefined
  if (error) throw new Error(`read video ${id}: ${error.message}`)
  if (!video) return null

  const { data: languages, error: languagesError } = await db
    .from('video_line_translations')
    .select('meaning_language')
    .eq('video_id', id)
  if (languagesError) throw new Error(`read video ${id}: ${languagesError.message}`)
  const available = [...new Set<string>((languages ?? []).map((row: any) => row.meaning_language))]
  const chosen =
    [meaningLanguage, 'en', ...available].find((code) => available.includes(code)) ??
    meaningLanguage

  const [linesResult, translationsResult, tokensResult, glossesResult] = await Promise.all([
    db
      .from('video_lines')
      .select('position, start_ms, end_ms, text, language')
      .eq('video_id', id)
      .order('position'),
    db
      .from('video_line_translations')
      .select('position, translation')
      .eq('video_id', id)
      .eq('meaning_language', chosen),
    db
      .from('video_tokens')
      .select(
        'line, position, start, end, surface, lemma, word_id, start_ms, end_ms, filter_reason',
      )
      .eq('video_id', id)
      .order('line')
      .order('position'),
    db
      .from('video_token_glosses')
      .select('line, position, gloss')
      .eq('video_id', id)
      .eq('meaning_language', chosen),
  ])
  for (const result of [linesResult, translationsResult, tokensResult, glossesResult]) {
    if (result.error) throw new Error(`read video ${id}: ${result.error.message}`)
  }

  const tokens = (tokensResult.data ?? []) as Array<Record<string, any>>
  const wordIds = [...new Set(tokens.flatMap((token) => token.word_id ?? []))] as number[]
  // The learner's own client, so words their videos added (owner_id) resolve as well.
  const slugs = await findWordSlugs(await getSupabase(), wordIds)
  const translations = new Map<number, string>(
    (translationsResult.data ?? []).map((row: any) => [row.position, row.translation]),
  )
  const glosses = new Map<string, string>(
    (glossesResult.data ?? []).map((row: any) => [`${row.line}:${row.position}`, row.gloss]),
  )
  const tokensByLine = new Map<number, Array<Record<string, any>>>()
  for (const token of tokens) {
    tokensByLine.set(token.line, [...(tokensByLine.get(token.line) ?? []), token])
  }

  return {
    id: video.id,
    title: video.title,
    language: video.language,
    meaningLanguage: chosen,
    lines: (linesResult.data ?? []).map((line: any) => ({
      position: line.position,
      startMs: line.start_ms,
      endMs: line.end_ms,
      text: line.text,
      translation: translations.get(line.position) ?? null,
      tokens: (tokensByLine.get(line.position) ?? []).map((token) => ({
        start: token.start,
        end: token.end,
        surface: token.surface,
        lemma: token.lemma,
        slug: token.word_id == null ? null : (slugs.get(token.word_id) ?? null),
        gloss: glosses.get(`${token.line}:${token.position}`) ?? null,
        startMs: token.start_ms ?? null,
        endMs: token.end_ms ?? null,
        filtered: toFilteredKind(token.filter_reason),
      })),
    })),
  }
}
