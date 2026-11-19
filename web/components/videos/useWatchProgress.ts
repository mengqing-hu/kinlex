'use client'

import { useRouter } from 'next/navigation'
import { type RefObject, useEffect, useRef } from 'react'

import type { VideoProgress } from '@/lib/videos/types'
import { isNearEnd, resumePositionMs } from '@/lib/videos/watch'

// How often the position is saved while the video plays.
const SAVE_INTERVAL_MS = 5000

// Opens the video where the learner left it, unless the link asks for a time (?t=), and saves how
// far they get: every few seconds while it plays, and when it pauses, ends or the page is left.
// Nothing is saved until the video has played, so opening and leaving it keeps the saved place.
export function useWatchProgress(
  videoRef: RefObject<HTMLVideoElement | null>,
  videoId: string,
  initial: VideoProgress | null,
): void {
  // Read once: a refreshed page hands in new progress, which must not move the player again.
  const resumeRef = useRef(resumePositionMs(initial))
  const router = useRouter()

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let played = false
    let lastSave = 0

    const save = (finished = false): Promise<unknown> | null => {
      if (!played) return null
      lastSave = Date.now()
      const positionMs = video.currentTime * 1000
      const durationMs = Number.isFinite(video.duration) ? video.duration * 1000 : 0
      return fetch(`/api/v1/videos/${videoId}/progress`, {
        method: 'PUT',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionMs,
          finished: finished || isNearEnd(positionMs, durationMs),
        }),
      }).catch(() => undefined)
    }

    const resume = () => {
      if (resumeRef.current > 0) video.currentTime = resumeRef.current / 1000
    }
    const onPlay = () => {
      played = true
    }
    const onTimeUpdate = () => {
      if (!video.paused && Date.now() - lastSave >= SAVE_INTERVAL_MS) void save()
    }
    const onPause = () => void save()
    const onEnded = () => void save(true)
    const onPageHide = () => void save()

    // A link to a moment of the video (?t=) goes there instead; the study page handles it.
    if (!new URLSearchParams(window.location.search).has('t')) {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) resume()
      else video.addEventListener('loadedmetadata', resume, { once: true })
    }
    video.addEventListener('play', onPlay)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('pause', onPause)
    video.addEventListener('ended', onEnded)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      // Leaving for another page of the site. Once the position is saved, that page (the library,
      // often restored from the router's cache) is fetched again so it shows the new progress.
      void save()?.then(() => router.refresh())
      video.removeEventListener('loadedmetadata', resume)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('ended', onEnded)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [videoRef, videoId, router])
}
