'use client'

import { useRef, useState } from 'react'

import { SettingRow } from '@/components/me/SettingRow'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useRouter } from '@/i18n/navigation'
import { fetchApiData } from '@/lib/client/apiClient'
import { announceProfile } from '@/lib/client/profileEvents'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import type { UserProfile } from '@/types/domain'

const AVATAR_BUCKET = 'avatars'
const AVATAR_SIZE = 256
const MAX_SOURCE_BYTES = 10 * 1024 * 1024

interface ProfileCardProps {
  profile: UserProfile
  userId: string
  email: string | null
  // The name Google gave, shown while the user has not set one of their own.
  fallbackName: string | null
  details: [label: string, value: string][]
}

// Crops the picture to a centered square and scales it down, so a phone photo of several
// megabytes becomes a small file. Browsers that cannot encode WebP fall back to PNG.
async function toAvatarBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  canvas
    .getContext('2d')
    ?.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    )
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not read the picture'))),
      'image/webp',
      0.9,
    ),
  )
}

function saveProfile(update: Partial<Pick<UserProfile, 'displayName' | 'avatarPath'>>) {
  return fetchApiData<UserProfile>('/api/v1/me/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  })
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1 1-4 11.5-11.5Z" />
    </svg>
  )
}

export function ProfileCard({ profile, userId, email, fallbackName, details }: ProfileCardProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [current, setCurrent] = useState(profile)
  const [nameDraft, setNameDraft] = useState(profile.displayName ?? fallbackName ?? '')
  const [busy, setBusy] = useState<'name' | 'avatar' | null>(null)
  const [message, setMessage] = useState('')

  const displayName = current.displayName ?? fallbackName

  async function run(kind: 'name' | 'avatar', task: () => Promise<UserProfile>) {
    setBusy(kind)
    setMessage('')
    try {
      const saved = await task()
      setCurrent(saved)
      announceProfile(saved)
      // The rest of the page reads the profile on the server.
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The request failed. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  // The name saves when the field loses focus or Enter is pressed, and only if it changed.
  function saveName() {
    const next = nameDraft.trim() || null
    if (next === (current.displayName ?? fallbackName ?? null)) {
      setNameDraft(displayName ?? '')
      return
    }
    void run('name', async () => {
      const saved = await saveProfile({ displayName: next })
      // An emptied name falls back to the Google one, so the field shows that again.
      setNameDraft(saved.displayName ?? fallbackName ?? '')
      return saved
    })
  }

  async function uploadAvatar(file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setMessage('Please choose a PNG, JPEG or WebP picture.')
      return
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setMessage('Please choose a picture smaller than 10 MB.')
      return
    }

    await run('avatar', async () => {
      const blob = await toAvatarBlob(file)
      const extension = blob.type === 'image/webp' ? 'webp' : 'png'
      // A new name for every upload, so browsers and the CDN never show a cached old picture.
      const path = `${userId}/${crypto.randomUUID()}.${extension}`
      const { error } = await getBrowserSupabase()
        .storage.from(AVATAR_BUCKET)
        .upload(path, blob, { contentType: blob.type })
      if (error) throw new Error('The upload failed. Please try again.')
      return saveProfile({ avatarPath: path })
    })
  }

  const avatar = (
    <Avatar
      className="size-12 bg-[var(--bg)] text-sm text-[var(--mute)]"
      name={displayName ?? email ?? '?'}
      url={current.avatarUrl}
    >
      {/* A pencil over the picture under the pointer; it stays, pulsing, while uploading. */}
      <span
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-center bg-[var(--bg)]/80 text-[var(--ink)] transition-opacity ${
          busy === 'avatar'
            ? 'animate-pulse opacity-100'
            : 'opacity-0 group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100'
        }`}
      >
        <PencilIcon />
      </span>
    </Avatar>
  )
  const avatarButtonClassName =
    'group/avatar rounded-full focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait'

  return (
    <Card aria-labelledby="profile-heading">
      <h1 className="text-lg font-semibold" id="profile-heading">
        Profile
      </h1>
      <input
        ref={fileInputRef}
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void uploadAvatar(file)
        }}
      />
      <div className="mt-2 divide-y divide-[var(--line)]">
        <SettingRow hint="PNG, JPEG, or WebP, up to 10MB." label="Profile photo">
          {current.avatarUrl ? (
            // With a picture there is a choice to make, so the click opens a small menu.
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Change profile photo"
                className={avatarButtonClassName}
                disabled={busy !== null}
              >
                {avatar}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                  Upload new photo
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => void run('avatar', () => saveProfile({ avatarPath: null }))}
                >
                  Remove photo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              aria-label="Upload profile photo"
              className={avatarButtonClassName}
              disabled={busy !== null}
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatar}
            </button>
          )}
        </SettingRow>

        <SettingRow label="Display name" labelFor="profile-display-name">
          <input
            className="min-h-9 w-56 rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 text-sm text-[var(--ink)] transition-colors placeholder:text-[var(--mute)] hover:border-[var(--mute)] focus-visible:border-[var(--mute)] focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:outline-none disabled:opacity-60 sm:w-72"
            disabled={busy === 'name'}
            id="profile-display-name"
            maxLength={80}
            placeholder={email ?? ''}
            value={nameDraft}
            onBlur={saveName}
            onChange={(event) => setNameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                const input = event.currentTarget
                setNameDraft(displayName ?? '')
                // Blurs after the restored name renders, so the blur finds nothing to save.
                setTimeout(() => input.blur())
              }
            }}
          />
        </SettingRow>

        <SettingRow label="Email">
          <span className="truncate text-sm text-[var(--mute)]">{email ?? '—'}</span>
        </SettingRow>
        {details.map(([label, value]) => (
          <SettingRow key={label} label={label}>
            <span className="text-sm text-[var(--mute)]">{value}</span>
          </SettingRow>
        ))}
      </div>
      <p aria-live="polite" className="text-sm text-red-700 dark:text-red-400">
        {message}
      </p>
    </Card>
  )
}
