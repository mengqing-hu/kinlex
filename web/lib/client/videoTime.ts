import { type RefObject, useEffect, useState } from 'react'

// The playing time of a video element in milliseconds: every frame while it plays, so captions
// change on time, and after each seek while it is paused.
export function useVideoTime(videoRef: RefObject<HTMLVideoElement | null>): number {
  const [timeMs, setTimeMs] = useState(0)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let frame = 0

    const read = () => setTimeMs(Math.round(video.currentTime * 1000))
    const follow = () => {
      read()
      if (!video.paused) frame = requestAnimationFrame(follow)
    }
    const start = () => {
      cancelAnimationFrame(frame)
      follow()
    }

    video.addEventListener('play', start)
    video.addEventListener('seeked', read)
    video.addEventListener('pause', read)
    return () => {
      cancelAnimationFrame(frame)
      video.removeEventListener('play', start)
      video.removeEventListener('seeked', read)
      video.removeEventListener('pause', read)
    }
  }, [videoRef])

  return timeMs
}
