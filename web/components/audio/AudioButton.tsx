'use client'

import { useAudioPlayer } from './AudioProvider'

interface AudioButtonProps {
  url: string | null
  label: string
  slowLabel: string
  // Given, a missing recording shows as a disabled button with this title instead of nothing,
  // for layouts where the button should always sit in the same place.
  unavailableLabel?: string
  large?: boolean
}

function SpeakerIcon({ large }: { large: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={large ? 'size-6' : 'size-4'}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
      <path d="M15 9.5a4 4 0 0 1 0 5" />
      <path d="M17.5 7a7 7 0 0 1 0 10" />
    </svg>
  )
}

export function AudioButton({
  url,
  label,
  slowLabel,
  unavailableLabel,
  large = false,
}: AudioButtonProps) {
  const { activeUrl, isPlaying, playAudio } = useAudioPlayer()
  const sizeClassName = large ? 'size-10' : 'size-7'

  if (!url) {
    return unavailableLabel ? (
      <button
        aria-label={unavailableLabel}
        className={`inline-flex ${sizeClassName} shrink-0 cursor-not-allowed items-center justify-center rounded-full text-[var(--mute)] opacity-40`}
        disabled
        title={unavailableLabel}
        type="button"
      >
        <SpeakerIcon large={large} />
      </button>
    ) : null
  }

  const isCurrentAudioPlaying = activeUrl === url && isPlaying
  const accessibleLabel = activeUrl === url ? slowLabel : label

  return (
    <button
      aria-label={accessibleLabel}
      className={`inline-flex ${sizeClassName} shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--info)] ${isCurrentAudioPlaying ? 'text-[var(--info)]' : 'text-[var(--mute)]'}`}
      title={accessibleLabel}
      type="button"
      onClick={() => playAudio(url)}
    >
      <SpeakerIcon large={large} />
    </button>
  )
}
