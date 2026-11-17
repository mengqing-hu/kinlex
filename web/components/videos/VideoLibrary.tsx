'use client'

import { useSearchParams } from 'next/navigation'
import { type ReactNode, useState } from 'react'

import { type ViewToggleLabels, ViewToggle, wordListViews } from '@/components/list/ViewToggle'
import { type LibraryVideo, VideoItem, type VideoItemLabels } from '@/components/videos/VideoItem'
import { usePathname, useRouter } from '@/i18n/navigation'

export interface VideoLibraryLabels {
  title: string
  intro: string
  addVideo: string
  closeAdd: string
  empty: string
  // Template with {languages}.
  explainedIn: string
  views: ViewToggleLabels
  item: VideoItemLabels
}

interface VideoLibraryProps {
  videos: LibraryVideo[]
  // The form that adds a video, shown above the library when asked for.
  addForm: ReactNode
  // Open the form straight away, e.g. while a video is still being processed.
  addOpen: boolean
  labels: VideoLibraryLabels
}

// Every processed video, as cards with their stills or as a list, like the vocabulary.
export function VideoLibrary({ videos, addForm, addOpen, labels }: VideoLibraryProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [showAdd, setShowAdd] = useState(addOpen || videos.length === 0)
  // Cards are the default, so they leave the URL clean.
  const view = wordListViews.find((option) => option === searchParams.get('view')) ?? 'cards'

  function changeView(next: typeof view) {
    const params = new URLSearchParams(searchParams)
    if (next === 'cards') params.delete('view')
    else params.set('view', next)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
            {labels.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--mute)]">{labels.intro}</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle labels={labels.views} view={view} onChange={changeView} />
          <button
            aria-expanded={showAdd}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 text-sm font-semibold text-[var(--card)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
            type="button"
            onClick={() => setShowAdd((open) => !open)}
          >
            <svg
              aria-hidden="true"
              className={`size-4 transition-transform ${showAdd ? 'rotate-45' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {showAdd ? labels.closeAdd : labels.addVideo}
          </button>
        </div>
      </div>

      {/* Kept mounted while hidden, so jobs it follows keep being followed. */}
      <div className={showAdd ? 'mt-8' : 'hidden'}>{addForm}</div>

      <section aria-label={labels.title} className="mt-8">
        {videos.length === 0 ? (
          <p className="py-12 text-center text-[var(--mute)]">{labels.empty}</p>
        ) : view === 'cards' ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {videos.map((video) => (
              <VideoItem
                explainedIn={labels.explainedIn}
                key={`${video.language}:${video.id}`}
                labels={labels.item}
                video={video}
                view={view}
              />
            ))}
          </ul>
        ) : (
          <ul>
            {videos.map((video) => (
              <VideoItem
                explainedIn={labels.explainedIn}
                key={`${video.language}:${video.id}`}
                labels={labels.item}
                video={video}
                view={view}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
