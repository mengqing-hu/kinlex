'use client'

import { useRouter as useNextRouter } from 'next/navigation'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Link, useRouter } from '@/i18n/navigation'

export interface VideoNavLabels {
  videoOptions: string
  rename: string
  delete: string
  // Raw template with a {title} placeholder.
  deleteConfirm: string
}

interface VideoNavItemProps {
  id: string
  title: string
  href: string
  language: string
  current: boolean
  labels: VideoNavLabels
}

const itemClass = 'block truncate rounded-md py-1.5 pr-7 pl-2 text-xs'

// A processed video in the sidebar, with a menu to rename it in place or delete it.
export function VideoNavItem({ id, title, href, language, current, labels }: VideoNavItemProps) {
  const router = useRouter()
  const nextRouter = useNextRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)
  const endpoint = `/api/v1/videos/${id}?lang=${language}`

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  async function saveTitle() {
    setEditing(false)
    const next = draft.trim()
    if (!next || next === title) {
      setDraft(title)
      return
    }
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: next }),
    })
    if (!response.ok) setDraft(title)
    nextRouter.refresh()
  }

  async function deleteVideo() {
    if (!window.confirm(labels.deleteConfirm.replace('{title}', title))) return
    const response = await fetch(endpoint, { method: 'DELETE' })
    if (!response.ok) return
    if (current) router.push(`/${language}/videos`)
    nextRouter.refresh()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void saveTitle()
    } else if (event.key === 'Escape') {
      setDraft(title)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <input
        aria-label={labels.rename}
        className="w-full rounded-md border border-[var(--info)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--ink)] outline-none"
        ref={inputRef}
        value={draft}
        onBlur={() => void saveTitle()}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
      />
    )
  }

  return (
    <div className="group relative">
      <Link
        aria-current={current ? 'page' : undefined}
        className={`${itemClass} ${
          current
            ? 'bg-[var(--bg)] font-semibold text-[var(--ink)]'
            : 'text-[var(--mute)] hover:bg-[var(--bg)] hover:text-[var(--ink)]'
        }`}
        href={href}
        title={title}
      >
        {title}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={labels.videoOptions}
          className="absolute top-1/2 right-1 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded text-[var(--mute)] opacity-0 group-hover:opacity-100 hover:bg-[var(--line)] hover:text-[var(--ink)] focus-visible:opacity-100 data-[state=open]:opacity-100"
          title={labels.videoOptions}
        >
          <svg aria-hidden="true" className="size-3.5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </DropdownMenuTrigger>
        {/* Focus stays with the rename box rather than going back to the button. */}
        <DropdownMenuContent
          align="start"
          className="min-w-32"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DropdownMenuItem
            onSelect={() => {
              setDraft(title)
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
    </div>
  )
}
