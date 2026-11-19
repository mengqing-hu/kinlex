// Filtering and sorting the video library. A plain module, so the page and its tests can use it.

import type { SortOrder } from '@/lib/constants'
import type { VideoProgress } from '@/lib/videos/types'

export interface LibraryVideo {
  id: string
  href: string
  // The language the video is in, which its page and its rename and delete calls go under.
  language: string
  languageName: string
  title: string
  // The names of the languages its words and sentences are explained in.
  meaningLanguageNames: string[]
  // When the video was added, as an ISO date; null when it is not known.
  addedAt: string | null
  durationMs: number | null
  // How far the learner has watched it, or null when they have not.
  progress: VideoProgress | null
}

// 'added' is the default order: the newest videos first.
export const videoSorts = ['added', 'duration', 'title'] as const
export type VideoSort = (typeof videoSorts)[number]

export const defaultVideoSortOrders: Record<VideoSort, SortOrder> = {
  added: 'desc',
  duration: 'asc',
  title: 'asc',
}

// How long ago a video was added, in days.
export const addedRanges = ['7', '30', '90'] as const
export type AddedRange = (typeof addedRanges)[number]

// Short is under five minutes, long over fifteen.
export const durationRanges = ['short', 'medium', 'long'] as const
export type DurationRange = (typeof durationRanges)[number]

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

export interface VideoFilters {
  query: string
  // A language code, or '' for every language.
  language: string
  added: AddedRange | ''
  duration: DurationRange | ''
}

export function durationRangeOf(durationMs: number | null): DurationRange | null {
  if (durationMs === null) return null
  if (durationMs < 5 * MINUTE_MS) return 'short'
  if (durationMs <= 15 * MINUTE_MS) return 'medium'
  return 'long'
}

export function isAddedWithin(video: LibraryVideo, range: AddedRange, now: number): boolean {
  if (video.addedAt === null) return false
  return now - Date.parse(video.addedAt) <= Number(range) * DAY_MS
}

export function matchesFilters(video: LibraryVideo, filters: VideoFilters, now: number): boolean {
  const query = filters.query.trim().toLocaleLowerCase()
  return (
    (!query || video.title.toLocaleLowerCase().includes(query)) &&
    (!filters.language || video.language === filters.language) &&
    (!filters.added || isAddedWithin(video, filters.added, now)) &&
    (!filters.duration || durationRangeOf(video.durationMs) === filters.duration)
  )
}

// Videos without the value sorted on go last whichever way the list runs.
function compareNullable(left: number | null, right: number | null, order: SortOrder): number {
  if (left === null || right === null) return Number(left === null) - Number(right === null)
  return order === 'asc' ? left - right : right - left
}

export function sortVideos(
  videos: readonly LibraryVideo[],
  sort: VideoSort,
  order: SortOrder,
): LibraryVideo[] {
  return videos.toSorted((left, right) => {
    const byTitle = left.title.localeCompare(right.title)
    if (sort === 'title') return order === 'asc' ? byTitle : -byTitle
    const compared =
      sort === 'added'
        ? compareNullable(
            left.addedAt === null ? null : Date.parse(left.addedAt),
            right.addedAt === null ? null : Date.parse(right.addedAt),
            order,
          )
        : compareNullable(left.durationMs, right.durationMs, order)
    return compared || byTitle
  })
}

// 1:05:09 or 12:31, as video players show a length.
export function formatDuration(durationMs: number): string {
  const seconds = Math.round(durationMs / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds / 60) % 60
  const rest = String(seconds % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}

// 1:05:09 or 02:31, as a player shows where it is: the minutes always have two digits.
export function formatClock(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = String(Math.floor(seconds / 60) % 60).padStart(2, '0')
  const rest = String(seconds % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${minutes}:${rest}` : `${minutes}:${rest}`
}
