import type { ReactNode } from 'react'

// Up to two letters, one from each of the first two words, as in "MH" for "Mengqing Hu".
export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0], words[1]] : [name.trim()]
  return (
    letters
      .map((word) => Array.from(word ?? '')[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  )
}

interface AvatarProps {
  url: string | null
  // Gives the initials shown while there is no picture.
  name: string
  // Size and colours of the circle, e.g. 'size-8 text-sm bg-[var(--ink)] text-[var(--card)]'.
  className: string
  // Drawn over the picture, such as an edit hint.
  children?: ReactNode
}

export function Avatar({ url, name, className, children }: AvatarProps) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${className}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small user upload from storage
        <img alt="" className="size-full object-cover" src={url} />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
      {children}
    </span>
  )
}
