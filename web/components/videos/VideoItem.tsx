'use client'

import { useRouter } from 'next/navigation'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'

import type { WordListView } from '@/components/list/ViewToggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Link } from '@/i18n/navigation'
import { formatDuration, type LibraryVideo } from '@/lib/videos/library'

export interface VideoItemLabels {
  videoOptions: string
  rename: string
  delete: string
  // Raw template with a {title} placeholder.
  deleteConfirm: string
}

interface VideoItemProps {
  video: LibraryVideo
  view: WordListView
  // Template with {languages}.
  explainedIn: string
  // The date added as the interface shows it, or null when it is not known.
  addedLabel: string | null
  labels: VideoItemLabels
}

// YouTube's 16:9 still of the video.
function thumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
}

// A processed video in the library, as a card with its still or as a row, with a menu to rename it
// in place or delete it.
export function VideoItem({ video, view, explainedIn, addedLabel, labels }: VideoItemProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(video.title)
  const inputRef = useRef<HTMLInputElement>(null)
  const endpoint = `/api/v1/videos/${video.id}?lang=${video.language}`

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  async function saveTitle() {
    setEditing(false)
    const next = draft.trim()
    if (!next || next === video.title) {
      setDraft(video.title)
      return
    }
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: next }),
    })
    if (!response.ok) setDraft(video.title)
    router.refresh()
  }

  async function deleteVideo() {
    if (!window.confirm(labels.deleteConfirm.replace('{title}', video.title))) return
    const response = await fetch(endpoint, { method: 'DELETE' })
    if (response.ok) router.refresh()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void saveTitle()
    } else if (event.key === 'Escape') {
      setDraft(video.title)
      setEditing(false)
    }
  }

  const cards = view === 'cards'
  const details = [
    video.languageName,
    video.meaningLanguageNames.length > 0
      ? explainedIn.replace('{languages}', video.meaningLanguageNames.join(', '))
      : null,
    addedLabel,
  ]
    .filter(Boolean)
    .join(' · ')

  const title = editing ? (
    <input
      aria-label={labels.rename}
      className="w-full rounded-md border border-[var(--info)] bg-[var(--card)] px-2 py-1 text-sm text-[var(--ink)] outline-none"
      ref={inputRef}
      value={draft}
      onBlur={() => void saveTitle()}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={handleKeyDown}
    />
  ) : (
    <Link
      className={`rounded-sm font-semibold text-[var(--ink)] after:absolute after:inset-0 after:content-[''] focus-visible:outline-none ${
        cards ? 'line-clamp-2 text-base leading-6' : 'truncate text-sm'
      }`}
      href={video.href}
      title={video.title}
    >
      {video.title}
    </Link>
  )

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={labels.videoOptions}
        // Above the link that covers the item, so it opens the menu rather than the video.
        className="relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--mute)] hover:bg-[var(--bg)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none"
        title={labels.videoOptions}
      >
        <svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </DropdownMenuTrigger>
      {/* Focus stays with the rename box rather than going back to the button. */}
      <DropdownMenuContent
        align="end"
        className="min-w-32"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuItem
          onSelect={() => {
            setDraft(video.title)
            setEditing(true)
          }}
        >
          {labels.rename}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-[var(--familiarity-1)]"
          onSelect={() => void deleteVideo()}
        >
          {labels.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const thumbnail = (
    // eslint-disable-next-line @next/next/no-img-element -- a remote still, shown as YouTube serves it.
    <img
      alt=""
      className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
      decoding="async"
      loading="lazy"
      src={thumbnailUrl(video.id)}
    />
  )

  // The length over the corner of the still, as video sites show it.
  const duration =
    video.durationMs === null ? null : (
      <span
        className={`absolute rounded-md bg-black/70 font-semibold text-white tabular-nums backdrop-blur-sm ${
          cards
            ? 'right-2 bottom-2 px-2 py-1 text-[13px] leading-none'
            : 'right-1 bottom-1 px-1.5 py-0.5 text-[11px] leading-tight'
        }`}
      >
        {formatDuration(video.durationMs)}
      </span>
    )

  if (cards) {
    return (
      <li className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] transition-colors focus-within:ring-2 focus-within:ring-[var(--info)] hover:border-[var(--root)]">
        <div className="relative aspect-video overflow-hidden bg-[var(--bg)]">
          {thumbnail}
          {duration}
        </div>
        <div className="flex items-start gap-1 p-4 pr-2">
          <div className="min-w-0 flex-1">
            {title}
            <p className="mt-1 truncate text-xs text-[var(--mute)]">{details}</p>
          </div>
          {menu}
        </div>
      </li>
    )
  }

  return (
    <li className="group relative flex items-center gap-4 rounded-md border-b border-[var(--line)] px-2 py-2 transition-colors last:border-b-0 focus-within:ring-2 focus-within:ring-[var(--info)] hover:bg-[var(--row-hover)]">
      <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-[var(--bg)] sm:w-36">
        {thumbnail}
        {duration}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0">{title}</div>
        <p className="mt-1 truncate text-xs text-[var(--mute)]">{details}</p>
      </div>
      {menu}
    </li>
  )
}
