import 'server-only'

import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { findWordSlugs } from '@/lib/repositories/wordRepository'
import { getPublicSupabase } from '@/lib/supabase/server'
import type { StudyVideo, StudyVideoSummary } from '@/lib/videos/types'

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
  const files = (await listFiles(language)).filter((file) => file.id === id)
  for (const { meaningLanguage } of files) {
    const file = path.join(videoDirectory(language), `${id}.${meaningLanguage}.json`)
    const data = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>
    await writeFile(file, JSON.stringify({ ...data, title }, null, 1), 'utf8')
  }
  return files.length > 0
}

// Removes the downloaded video, its study files and its processing logs; false when there was
// nothing to remove.
export async function deleteStudyVideo(language: string, id: string): Promise<boolean> {
  if (!VIDEO_ID.test(id)) return false
  const directory = videoDirectory(language)
  const names = (await readdir(directory).catch(() => [])).filter((name) =>
    name.startsWith(`${id}.`),
  )
  await Promise.all(names.map((name) => rm(path.join(directory, name), { force: true })))
  return names.length > 0
}

// The processed videos of a language, by title.
export async function listStudyVideos(language: string): Promise<StudyVideoSummary[]> {
  const byId = new Map<string, string[]>()
  for (const file of await listFiles(language)) {
    byId.set(file.id, [...(byId.get(file.id) ?? []), file.meaningLanguage])
  }
  const videos = await Promise.all(
    [...byId].map(async ([id, meaningLanguages]) => {
      const { title } = await readStudyFile(language, id, meaningLanguages[0] ?? 'en')
      return { id, title, meaningLanguages }
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
      })),
    })),
  }
}
