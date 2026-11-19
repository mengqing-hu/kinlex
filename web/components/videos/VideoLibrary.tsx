'use client'

import { useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { type ReactNode, useState } from 'react'

import { FilterSelect } from '@/components/list/FilterSelect'
import { SortSelect, type SortSelectLabels } from '@/components/list/SortSelect'
import { type ViewToggleLabels, ViewToggle, wordListViews } from '@/components/list/ViewToggle'
import { VideoItem, type VideoItemLabels } from '@/components/videos/VideoItem'
import { usePathname, useRouter } from '@/i18n/navigation'
import { sortOrders } from '@/lib/constants'
import {
  type AddedRange,
  addedRanges,
  defaultVideoSortOrders,
  type DurationRange,
  durationRanges,
  type LibraryVideo,
  matchesFilters,
  sortVideos,
  type VideoFilters,
  videoSorts,
} from '@/lib/videos/library'

export interface VideoLibraryLabels {
  title: string
  empty: string
  noMatches: string
  search: string
  searchPlaceholder: string
  language: string
  allLanguages: string
  channel: string
  allChannels: string
  added: string
  addedAnyTime: string
  addedRanges: Record<AddedRange, string>
  duration: string
  anyDuration: string
  durationRanges: Record<DurationRange, string>
  sorting: SortSelectLabels<(typeof videoSorts)[number]>
  // Template with {languages}.
  explainedIn: string
  views: ViewToggleLabels
  item: VideoItemLabels
}

interface VideoLibraryProps {
  videos: LibraryVideo[]
  // The bar over the library, with adding a video and following its processing.
  toolbar: ReactNode
  // When the page was made, so the server and the browser count recent videos alike.
  now: number
  labels: VideoLibraryLabels
}

function pick<T extends string>(options: readonly T[], value: string | null): T | '' {
  return options.find((option) => option === value) ?? ''
}

// Every processed video, as cards with their stills or as a list, like the vocabulary, with
// filters and a sort that live in the address.
export function VideoLibrary({ videos, toolbar, now, labels }: VideoLibraryProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')
  // In UTC, so the server and the browser write the same date.
  const dateFormat = new Intl.DateTimeFormat(useLocale(), { dateStyle: 'medium', timeZone: 'UTC' })

  // Cards are the default, so they leave the URL clean.
  const view = wordListViews.find((option) => option === searchParams.get('view')) ?? 'cards'
  const sort = pick(videoSorts, searchParams.get('sort')) || null
  const order =
    pick(sortOrders, searchParams.get('order')) || defaultVideoSortOrders[sort ?? 'added']
  const filters: VideoFilters = {
    query,
    language: videos.some((video) => video.language === searchParams.get('language'))
      ? (searchParams.get('language') ?? '')
      : '',
    // A channel no video shows any more lists every channel, as a language does.
    channel: videos.some((video) => video.channel?.id === searchParams.get('channel'))
      ? (searchParams.get('channel') ?? '')
      : '',
    added: pick(addedRanges, searchParams.get('added')),
    duration: pick(durationRanges, searchParams.get('duration')),
  }

  function updateParams(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams)
    for (const [name, value] of Object.entries(changes)) {
      if (value) params.set(name, value)
      else params.delete(name)
    }
    const next = params.toString()
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
  }

  // How many videos choosing an option would show, given the other filters.
  function countWith(change: Partial<VideoFilters>): number {
    const chosen = { ...filters, ...change }
    return videos.filter((video) => matchesFilters(video, chosen, now)).length
  }

  const languages = [
    ...new Map(videos.map((video) => [video.language, video.languageName])).entries(),
  ].toSorted((left, right) => left[1].localeCompare(right[1]))
  const channels = [
    ...new Map(
      videos.flatMap((video) =>
        video.channel ? [[video.channel.id, video.channel.name]] : [],
      ) as [string, string][],
    ).entries(),
  ].toSorted((left, right) => left[1].localeCompare(right[1]))
  const shown = sortVideos(
    videos.filter((video) => matchesFilters(video, filters, now)),
    sort ?? 'added',
    order,
  )

  const items = shown.map((video) => (
    <VideoItem
      addedLabel={video.addedAt === null ? null : dateFormat.format(new Date(video.addedAt))}
      explainedIn={labels.explainedIn}
      key={`${video.language}:${video.id}`}
      labels={labels.item}
      video={video}
      onChannel={(id) => updateParams({ channel: id })}
      view={view}
    />
  ))

  return (
    <>
      {toolbar}
      <main className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        {videos.length > 0 ? (
          <div className="flex flex-col gap-3 border-y border-[var(--line)] py-4 lg:flex-row lg:items-center">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {languages.length > 1 || filters.language ? (
                <FilterSelect
                  label={labels.language}
                  options={[
                    {
                      value: '',
                      label: labels.allLanguages,
                      count: countWith({ language: '' }),
                    },
                    ...languages.map(([code, name]) => ({
                      value: code,
                      label: name,
                      count: countWith({ language: code }),
                    })),
                  ]}
                  value={filters.language}
                  onChange={(value) => updateParams({ language: value })}
                />
              ) : null}
              {channels.length > 1 || filters.channel ? (
                <FilterSelect
                  label={labels.channel}
                  options={[
                    {
                      value: '',
                      label: labels.allChannels,
                      count: countWith({ channel: '' }),
                    },
                    ...channels.map(([id, name]) => ({
                      value: id,
                      label: name,
                      count: countWith({ channel: id }),
                    })),
                  ]}
                  value={filters.channel}
                  onChange={(value) => updateParams({ channel: value })}
                />
              ) : null}
              <FilterSelect
                label={labels.added}
                options={[
                  { value: '', label: labels.addedAnyTime, count: countWith({ added: '' }) },
                  ...addedRanges.map((range) => ({
                    value: range,
                    label: labels.addedRanges[range],
                    count: countWith({ added: range }),
                  })),
                ]}
                value={filters.added}
                onChange={(value) => updateParams({ added: value })}
              />
              <FilterSelect
                label={labels.duration}
                options={[
                  { value: '', label: labels.anyDuration, count: countWith({ duration: '' }) },
                  ...durationRanges.map((range) => ({
                    value: range,
                    label: labels.durationRanges[range],
                    count: countWith({ duration: range }),
                  })),
                ]}
                value={filters.duration}
                onChange={(value) => updateParams({ duration: value })}
              />
              <SortSelect
                defaultOrders={defaultVideoSortOrders}
                defaultSort="added"
                labels={labels.sorting}
                order={order}
                sort={sort}
                sorts={videoSorts}
                // The default order keeps the URL clean.
                onChange={(nextSort, nextOrder) =>
                  updateParams(
                    nextSort === null
                      ? { sort: '', order: '' }
                      : { sort: nextSort, order: nextOrder },
                  )
                }
              />
              <label className="relative w-full sm:w-auto sm:max-w-64 sm:min-w-40 sm:flex-1">
                <span className="sr-only">{labels.search}</span>
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--mute)]"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--card)] pr-3.5 pl-9 text-sm text-[var(--ink)] transition-colors placeholder:text-[var(--mute)] hover:border-[var(--mute)] focus-visible:border-[var(--mute)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
                  maxLength={100}
                  placeholder={labels.searchPlaceholder}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <ViewToggle
                labels={labels.views}
                view={view}
                onChange={(next) => updateParams({ view: next === 'cards' ? '' : next })}
              />
            </div>
          </div>
        ) : null}

        <section aria-label={labels.title} className="mt-6">
          {videos.length === 0 ? (
            <p className="py-12 text-center text-[var(--mute)]">{labels.empty}</p>
          ) : shown.length === 0 ? (
            <p className="py-12 text-center text-[var(--mute)]">{labels.noMatches}</p>
          ) : view === 'cards' ? (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{items}</ul>
          ) : (
            <ul>{items}</ul>
          )}
        </section>
      </main>
    </>
  )
}
